import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeModules } from 'react-native';
import { makeSynchronizer, Synchronizer } from 'react-native-zcash';
import type {
  InitializerConfig,
  ProposalSuccess,
  StatusEvent,
  Transaction,
} from 'react-native-zcash';
import { NETWORK, WALLET_ALIAS } from '../config';
import {
  friendlyError,
  HOME_NODE_SEND,
  OFFLINE_SEND,
  paymentSavedError,
  SEND_PENDING,
  SEND_REJECTED,
} from '../lib/errors';
import { canReachHomeNode, isOnline } from '../lib/network';
import { pruneSent, recordSent, txIdsFrom } from '../lib/sentLog';
import { Balances, loadLastBalance, saveLastBalance } from '../lib/lastBalance';
import { loadAddresses } from '../lib/addressBook';
import { addOwnAddresses } from '../lib/transactions';
import { getServer, isHomeNode, useServer } from '../lib/server';
import { getTorWanted, TorStatus, useTorWanted } from '../lib/tor';
import { mergeTransactions } from '../lib/transactions';
import type { StoredWallet } from './seed';
import type { PoolBalances } from '../lib/pools';

export type SyncStatus = StatusEvent['name'] | 'STARTING';

export interface WalletState {
  status: SyncStatus;
  /** 0–100 */
  scanProgress: number;
  /** Latest block of the network, 0 until the engine reports it. */
  networkHeight: number;
  totalZatoshi: string;
  availableZatoshi: string;
  /** Shielded funds that can be sent right now. */
  spendableZatoshi: string;
  /** The wallet's default private (shielded) address. */
  address: string | null;
  /** Public address: payments to it are visible to everyone. */
  transparentAddress: string | null;
  /** Funds sitting on the public address, waiting to be shielded. */
  transparentZatoshi: string;
  transactions: Transaction[];
  /** Whether sensitive network calls currently go through Tor. */
  tor: TorStatus;
  /** Per pool, as last reported by the engine; null until it reports. */
  pools: PoolBalances | null;
  error: string | null;
}

const initialState: WalletState = {
  status: 'STARTING',
  scanProgress: 0,
  networkHeight: 0,
  totalZatoshi: '0',
  availableZatoshi: '0',
  spendableZatoshi: '0',
  address: null,
  transparentAddress: null,
  transparentZatoshi: '0',
  transactions: [],
  tor: 'off',
  pools: null,
  error: null,
};

export interface Wallet extends WalletState {
  /** Builds a transfer and reports its fee, without sending anything. */
  proposeTransfer: (opts: {
    zatoshi: string;
    toAddress: string;
    memo?: string;
  }) => Promise<ProposalSuccess>;
  /**
   * Builds a transfer of everything spendable, leaving exactly the network
   * fee. Returns the proposal and the amount the receiver gets.
   */
  proposeMax: (opts: {
    toAddress: string;
    memo?: string;
  }) => Promise<{ proposal: ProposalSuccess; zatoshi: string }>;
  /** Signs and broadcasts a proposed transfer. Resolves to its txid. */
  sendProposal: (proposalBase64: string) => Promise<string>;
  /** A brand-new private address. Older ones keep working. */
  newShieldedAddress: () => Promise<string>;
  /** Incoming payments per own address, as { address: count }. */
  addressUsage: () => Promise<Record<string, number>>;
  /** Moves the public-address funds into the private balance. */
  shieldFunds: () => Promise<string>;
}

// Starts and stops run strictly one after another, app-wide.
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task, task);
}

// True once this app session has opened the wallet database.
let startedBefore = false;

/** After an erase, the next wallet opens a brand-new database. */
export function forgetSession(): void {
  startedBefore = false;
}

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/** Stops whatever native synchronizer exists for our wallet, if any. */
async function stopNative(): Promise<void> {
  try {
    await new Synchronizer(WALLET_ALIAS, NETWORK).stop();
    // Give the SDK a moment to release the wallet database.
    await wait(300);
  } catch {
    // Nothing was running.
  }
}

/** The SDK can briefly refuse to reopen a wallet it is still closing. */
async function startNative(config: InitializerConfig): Promise<Synchronizer> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await makeSynchronizer(config);
    } catch (e) {
      lastError = e;
      await wait(700);
    }
  }
  throw lastError;
}

function nativeMessage(e: unknown): string {
  if (e == null || typeof e !== 'object') return String(e);
  const { message, domain, userInfo } = e as {
    message?: string;
    domain?: string;
    userInfo?: { NSLocalizedDescription?: string };
  };
  const detail = userInfo?.NSLocalizedDescription ?? domain;
  return [message, detail].filter(Boolean).join(': ') || 'Unknown error';
}

/**
 * Runs the Zcash light client for one wallet and exposes its live state.
 * `isNew` must be true only the first time a freshly created phrase is used.
 */
export function useSynchronizer(wallet: StoredWallet, isNew: boolean): Wallet {
  const [state, setState] = useState<WalletState>(initialState);
  const live = useRef<Synchronizer | null>(null);
  const started = useRef(false);
  // True once the engine itself has reported a balance in this session.
  const liveBalance = useRef(false);

  // Until the engine reports, show the last balance it confirmed rather
  // than 0. Without a connection the engine reports nothing at all.
  useEffect(() => {
    let gone = false;
    loadLastBalance(wallet.birthdayHeight).then(saved => {
      if (gone || saved == null || liveBalance.current) return;
      setState(prev => ({ ...prev, ...saved }));
    });
    return () => {
      gone = true;
    };
  }, [wallet.birthdayHeight]);

  // Asks the engine to turn Tor on or off. A failure leaves the wallet on a
  // direct connection, and says so.
  const applyTor = useCallback(async (enable: boolean) => {
    const native = NativeModules.RNZcash;
    if (typeof native?.setTor !== 'function') {
      setState(prev => ({ ...prev, tor: enable ? 'unavailable' : 'off' }));
      return;
    }
    setState(prev => ({ ...prev, tor: enable ? 'starting' : 'off' }));
    try {
      await native.setTor(WALLET_ALIAS, enable);
      setState(prev => ({ ...prev, tor: enable ? 'on' : 'off' }));
    } catch {
      setState(prev => ({ ...prev, tor: enable ? 'failed' : 'off' }));
    }
  }, []);

  // Changing the server in Settings restarts the wallet on the new one.
  const server = useServer();

  useEffect(() => {
    let cancelled = false;
    let synchronizer: Synchronizer | undefined;
    const patch = (next: Partial<WalletState>) => {
      if (!cancelled) setState(prev => ({ ...prev, ...next }));
    };
    // A restart (another server, for example) keeps the balance on screen
    // until the engine reports again, instead of dropping it to 0.
    setState(prev => ({
      ...initialState,
      totalZatoshi: prev.totalZatoshi,
      availableZatoshi: prev.availableZatoshi,
      spendableZatoshi: prev.spendableZatoshi,
      transparentZatoshi: prev.transparentZatoshi,
      transactions: prev.transactions,
    }));
    started.current = false;

    enqueue(async () => {
      if (cancelled) return;
      try {
        // A native synchronizer can outlive the JavaScript that started it
        // (after a reload, for example). It would keep reporting to the old,
        // dead listeners, so always begin from a fresh one.
        await stopNative();
        synchronizer = await startNative({
          networkName: NETWORK,
          defaultHost: server.host,
          defaultPort: server.port,
          mnemonicSeed: wallet.mnemonic,
          alias: WALLET_ALIAS,
          birthdayHeight: wallet.birthdayHeight,
          newWallet: isNew && !startedBefore,
        });
        startedBefore = true;
        if (cancelled) return;
        live.current = synchronizer;
        synchronizer.subscribe({
          onBalanceChanged: balance => {
            if (cancelled) return;
            liveBalance.current = true;
            const next: Balances = {
              totalZatoshi: balance.totalZatoshi,
              availableZatoshi: balance.availableZatoshi,
              transparentZatoshi: balance.transparentTotalZatoshi,
              spendableZatoshi: (
                BigInt(balance.saplingAvailableZatoshi) +
                BigInt(balance.orchardAvailableZatoshi) +
                BigInt(balance.ironwoodAvailableZatoshi ?? '0')
              ).toString(),
            };
            // Part-way through a scan the engine can count less than the
            // wallet holds. Keep the higher figure until it is synced; the
            // engine reports again the moment it is.
            const pools: PoolBalances = {
              orchard: {
                total: balance.orchardTotalZatoshi,
                available: balance.orchardAvailableZatoshi,
              },
              sapling: {
                total: balance.saplingTotalZatoshi,
                available: balance.saplingAvailableZatoshi,
              },
              transparent: {
                total: balance.transparentTotalZatoshi,
                available: balance.transparentAvailableZatoshi,
              },
              ironwood: {
                total: balance.ironwoodTotalZatoshi ?? '0',
                available: balance.ironwoodAvailableZatoshi ?? '0',
              },
            };
            setState(prev =>
              prev.status !== 'SYNCED' &&
              BigInt(next.totalZatoshi) < BigInt(prev.totalZatoshi)
                ? { ...prev, pools }
                : { ...prev, ...next, pools },
            );
          },
          onStatusChanged: status =>
            // Reaching the network again clears an earlier connection error.
            patch(
              status.name === 'SYNCED' || status.name === 'SYNCING'
                ? { status: status.name, error: null }
                : { status: status.name },
            ),
          onTransactionsChanged: event => {
            if (cancelled) return;
            pruneSent(event.transactions);
            setState(prev => ({
              ...prev,
              transactions: mergeTransactions(
                prev.transactions,
                event.transactions,
              ),
            }));
          },
          onUpdate: event =>
            patch({
              scanProgress: event.scanProgress,
              networkHeight: event.networkBlockHeight,
            }),
          onError: error => patch({ error: friendlyError(error.message) }),
        });
        started.current = true;
        if (getTorWanted()) applyTor(true);
        const addresses = await synchronizer.deriveUnifiedAddress();
        addOwnAddresses([
          addresses.unifiedAddress,
          addresses.transparentAddress,
        ]);
        // Handed-out receive addresses, so payments to them read as own.
        loadAddresses(addresses.unifiedAddress).catch(() => []);
        patch({
          address: addresses.unifiedAddress,
          transparentAddress: addresses.transparentAddress,
        });
      } catch (e) {
        patch({ error: friendlyError(nativeMessage(e)) });
      }
    });

    return () => {
      cancelled = true;
      live.current = null;
      // Queued behind the start above, so a stop can never overtake it and
      // the next start always finds the previous synchronizer fully stopped.
      enqueue(async () => {
        if (synchronizer != null) {
          synchronizer.unsubscribe();
          await synchronizer.stop().catch(() => {});
        }
      });
    };
  }, [
    wallet.mnemonic,
    wallet.birthdayHeight,
    isNew,
    server.host,
    server.port,
    applyTor,
  ]);

  // Remember the balance whenever it changes while fully synced.
  const {
    status,
    totalZatoshi,
    availableZatoshi,
    spendableZatoshi,
    transparentZatoshi,
  } = state;
  useEffect(() => {
    if (status !== 'SYNCED' || !liveBalance.current) return;
    saveLastBalance(wallet.birthdayHeight, {
      totalZatoshi,
      availableZatoshi,
      spendableZatoshi,
      transparentZatoshi,
    });
  }, [
    status,
    totalZatoshi,
    availableZatoshi,
    spendableZatoshi,
    transparentZatoshi,
    wallet.birthdayHeight,
  ]);

  // Follow the Tor switch in Settings while the wallet is running.
  const torWanted = useTorWanted();
  useEffect(() => {
    if (started.current && live.current != null) applyTor(torWanted);
  }, [torWanted, applyTor]);

  const proposeTransfer = useCallback<Wallet['proposeTransfer']>(async opts => {
    if (live.current == null) throw new Error('The wallet is still starting');
    try {
      return await live.current.proposeTransfer(opts);
    } catch (e) {
      throw new Error(friendlyError(nativeMessage(e)));
    }
  }, []);

  const spendable = state.spendableZatoshi;
  const proposeMax = useCallback<Wallet['proposeMax']>(
    async ({ toAddress, memo }) => {
      // The fee depends on how many notes the payment uses, so it can't be
      // known up front. Start from the minimum fee and adjust until the
      // amount plus the fee the SDK quotes is exactly the spendable balance.
      const total = BigInt(spendable);
      let fee = 10_000n;
      let best: { proposal: ProposalSuccess; zatoshi: string } | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        const amount = total - fee;
        if (amount <= 0n) break;
        try {
          const proposal = await proposeTransfer({
            zatoshi: amount.toString(),
            toAddress,
            memo,
          });
          best = { proposal, zatoshi: amount.toString() };
          const quoted = BigInt(proposal.totalFee);
          if (quoted === fee) return best;
          fee = quoted;
        } catch (e) {
          lastError = e;
          fee += 5_000n;
        }
      }
      if (best != null) return best;
      if (lastError != null) throw lastError;
      throw new Error('The balance is too small to cover the network fee.');
    },
    [proposeTransfer, spendable],
  );

  const sendProposal = useCallback<Wallet['sendProposal']>(
    async proposalBase64 => {
      if (live.current == null) throw new Error('The wallet is still starting');
      // Offline, nothing is created at all.
      if (!(await isOnline())) throw new Error(OFFLINE_SEND);
      const current = getServer();
      if (isHomeNode(current) && !(await canReachHomeNode(current))) {
        throw new Error(HOME_NODE_SEND);
      }
      let result;
      try {
        result = await live.current.createTransfer({
          mnemonicSeed: wallet.mnemonic,
          proposalBase64,
        });
      } catch (e) {
        // Created but not delivered: the engine retries it by itself, so
        // the person must not send it again.
        const code = (e as { code?: string })?.code;
        const message = nativeMessage(e);
        const ids = txIdsFrom(message);
        if (
          code === 'SubmitPending' ||
          code === 'SubmitRejected' ||
          ids.length
        ) {
          recordSent(ids, true);
          throw paymentSavedError(
            code === 'SubmitRejected' ? SEND_REJECTED : SEND_PENDING,
          );
        }
        throw new Error(friendlyError(message));
      }
      if (typeof result !== 'string') {
        throw new Error(result.errorMessage ?? 'The transaction failed');
      }
      recordSent([result], false);
      return result;
    },
    [wallet.mnemonic],
  );

  const newShieldedAddress = useCallback<
    Wallet['newShieldedAddress']
  >(async () => {
    if (live.current == null) throw new Error('The wallet is still starting');
    // Added to the Zcash library by patches/react-native-zcash+*.patch.
    const native = NativeModules.RNZcash;
    if (typeof native?.deriveRotatingAddress !== 'function') {
      throw new Error('Rotating addresses are not available in this build');
    }
    try {
      return await native.deriveRotatingAddress(WALLET_ALIAS);
    } catch (e) {
      throw new Error(friendlyError(nativeMessage(e)));
    }
  }, []);

  const addressUsage = useCallback<Wallet['addressUsage']>(async () => {
    const native = NativeModules.RNZcash;
    if (live.current == null || typeof native?.addressUsage !== 'function') {
      return {};
    }
    try {
      return (await native.addressUsage(WALLET_ALIAS)) ?? {};
    } catch {
      return {};
    }
  }, []);

  const shieldFunds = useCallback<Wallet['shieldFunds']>(async () => {
    if (live.current == null) throw new Error('The wallet is still starting');
    try {
      return await live.current.shieldFunds({
        seed: wallet.mnemonic,
        memo: '',
        threshold: '10000',
      });
    } catch (e) {
      throw new Error(friendlyError(nativeMessage(e)));
    }
  }, [wallet.mnemonic]);

  return {
    ...state,
    proposeTransfer,
    proposeMax,
    sendProposal,
    newShieldedAddress,
    addressUsage,
    shieldFunds,
  };
}
