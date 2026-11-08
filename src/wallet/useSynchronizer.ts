import { recordSyncProblem } from '../lib/syncProblems';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeModules } from 'react-native';
import { makeSynchronizer, Synchronizer, Tools } from 'react-native-zcash';
import type {
  InitializerConfig,
  ProposalSuccess,
  StatusEvent,
  Transaction,
} from 'react-native-zcash';
import { NETWORK, WALLET_ALIAS } from '../config';
import {
  friendlyError,
  SYNC_DROPPED,
  SYNC_DROPPED_LONG,
  NU7_PAUSED,
  TOR_NOT_READY,
} from '../lib/errors';
import { canReachHomeNode, isOnline } from '../lib/network';
import { pruneSent, recordSent } from '../lib/sentLog';
import { Balances, loadLastBalance, saveLastBalance } from '../lib/lastBalance';
import { loadAddresses } from '../lib/addressBook';
import { addOwnAddresses } from '../lib/transactions';
import { getServer, serverLabel, useServer } from '../lib/server';
import { checkSecurityKey, loadSecurityKeyState } from '../lib/securityKey';
import {
  getTorWanted,
  torBlocksRelease,
  torForServer,
  TorStatus,
  useTorWanted,
} from '../lib/tor';
import { mergeTransactions } from '../lib/transactions';
import { nu7Pauses, setEngineKnowsNu7 } from '../lib/upgrades';
import { hasReleaseGrant } from '../lib/releaseGrant';
import { release } from './release';
import { amountInRequest } from '../lib/paymentUri';
import {
  hasFirstStartSeed,
  readSeed,
  SeedMissingError,
  takeFirstStartSeed,
  updateViewingKey,
} from './seed';
import {
  ALREADY_RELEASING,
  SEED_MISSING_LOCK_IN,
  SEED_NOT_RELEASED_LOCK_IN,
} from '../lib/errors';
import type { WalletKeys } from './seed';
import type { PoolBalances } from '../lib/pools';

/** After this long without progress, a dropped connection suggests another server. */
const SYNC_DROPPED_TIP_MS = 3 * 60 * 1000;

export type SyncStatus = StatusEvent['name'] | 'STARTING';

export interface WalletState {
  status: SyncStatus;
  /**
   * True once this wallet has been fully synced on this phone (now or in an
   * earlier session, from the saved balance). Until then, after a restore,
   * the history is still filling in, newest blocks first.
   */
  everSynced: boolean;
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
  /** The wallet did not start (e.g. Face ID cancelled): offer Try again. */
  startFailed: boolean;
}

const initialState: WalletState = {
  status: 'STARTING',
  everSynced: false,
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
  startFailed: false,
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
  /** Starts the wallet again after it failed to start (audit C-49). */
  retryStart: () => void;
}

// Starts and stops run strictly one after another, app-wide.
let queue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task, task);
}

/**
 * Fully up to date. After the first full sync the engine keeps reporting
 * SYNCED while it catches up, and only the scan progress moves (audit C-50):
 * a balance seen then is not yet the confirmed one.
 */
function settled(s: { status: string; scanProgress: number }): boolean {
  return s.status === 'SYNCED' && !(s.scanProgress > 0 && s.scanProgress < 100);
}

// Audit C-23: one release or lock-in at a time, whatever the screen. A
// second tap while one runs is refused here, before Face ID is asked.
let releasing = false;
async function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  if (releasing) throw new Error(ALREADY_RELEASING);
  releasing = true;
  try {
    return await task();
  } finally {
    releasing = false;
  }
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
      // Not a timing problem: retrying would not help.
      const code = (e as { code?: string })?.code;
      if (code === 'SeedRequired' || code === 'WalletMismatch') throw e;
      await wait(700);
    }
  }
  throw lastError;
}

/**
 * Starts the engine from the viewing key (self-audit K1). Only when the
 * engine needs the phrase once (a database migration, or an account that is
 * not set up on this phone yet) does iOS ask Face ID for it.
 */
async function startWallet(
  config: Omit<InitializerConfig, 'mnemonicSeed'>,
  wallet: WalletKeys,
): Promise<Synchronizer> {
  // Right after creating or restoring, the phrase is handed over once
  // (audit C-04); it is gone from memory after this call.
  const firstStart = takeFirstStartSeed();
  if (firstStart != null) {
    return startNative({ ...config, mnemonicSeed: firstStart });
  }
  try {
    return await startNative({ ...config, mnemonicSeed: wallet.ufvk });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code !== 'SeedRequired' && code !== 'WalletMismatch') throw e;
    const seed = await readSeed('Open your Zcash wallet');
    const started = await startNative({ ...config, mnemonicSeed: seed });
    if (code === 'WalletMismatch') {
      // The phrase opened this wallet, so the stored viewing key was only
      // written differently (a newer engine): keep the one it uses now.
      const ufvk = await Tools.deriveViewingKey(seed, NETWORK).catch(
        () => null,
      );
      if (ufvk) await updateViewingKey(wallet, ufvk).catch(() => {});
    }
    return started;
  }
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
export function useSynchronizer(wallet: WalletKeys, isNew: boolean): Wallet {
  const [state, setState] = useState<WalletState>(initialState);
  // Audit C-49: bumping this re-runs the start, e.g. after Face ID was
  // cancelled at a start that needed the phrase.
  const [startAttempt, setStartAttempt] = useState(0);
  const retryStart = useCallback(() => setStartAttempt(n => n + 1), []);
  // The engine's Tor state as last reported, for the release check (N1).
  // When the connection to the server first dropped, until syncing moves.
  const errorSince = useRef<number | null>(null);
  const torStatus = useRef<TorStatus>('off');
  torStatus.current = state.tor;
  const heightNow = useRef(0);
  heightNow.current = state.networkHeight;
  const live = useRef<Synchronizer | null>(null);

  const started = useRef(false);
  // True once the engine itself has reported a balance in this session.
  const liveBalance = useRef(false);

  // Until the engine reports, show the last balance it confirmed rather
  // than 0. Without a connection the engine reports nothing at all.
  useEffect(() => {
    let gone = false;
    loadLastBalance(wallet.birthdayHeight).then(saved => {
      if (gone || saved == null) return;
      if (liveBalance.current) {
        setState(prev => ({ ...prev, everSynced: true }));
        return;
      }
      setState(prev => ({ ...prev, ...saved, everSynced: true }));
    });
    return () => {
      gone = true;
    };
  }, [wallet.birthdayHeight]);

  // Asks the engine to turn Tor on or off. A failure leaves the wallet on a
  // direct connection, and says so. With the owner's own node (Rock it) the
  // wallet talks to it directly, also with Tor wanted: see torForServer.
  // Quick on/off taps: the engine calls run one after another, in order,
  // and only the latest request sets the status (re-check R8).
  const torRequest = useRef(0);
  const torQueue = useRef<Promise<void>>(Promise.resolve());
  const applyTor = useCallback((wanted: boolean) => {
    const request = ++torRequest.current;
    const settle = (tor: TorStatus) => {
      if (request === torRequest.current) setState(prev => ({ ...prev, tor }));
    };
    const run = async () => {
      const native = NativeModules.RNZcash;
      const enable = torForServer(wanted, getServer());
      const idle: TorStatus = wanted ? 'ownNode' : 'off';
      if (typeof native?.setTor !== 'function') {
        settle(enable ? 'unavailable' : idle);
        return;
      }
      settle(enable ? 'starting' : idle);
      try {
        await native.setTor(WALLET_ALIAS, enable);
        settle(enable ? 'on' : idle);
      } catch {
        settle(enable ? 'failed' : idle);
      }
    };
    torQueue.current = torQueue.current.then(run, run);
    return torQueue.current;
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
        // Audit C-25: with Tor wanted, the engine brings Tor up before its
        // first sync pass instead of after it.
        const bridge = NativeModules.RNZcash;
        // Audit C-49: a restored wallet starts in the SDK's restore mode.
        if (typeof bridge?.setRestoreAtStart === 'function') {
          await bridge
            .setRestoreAtStart(hasFirstStartSeed() && !isNew)
            .catch(() => {});
        }
        // Audit C-42: ask the linked engine itself whether it knows NU7; an
        // engine that does not is paused like any pre-NU7 engine.
        if (typeof bridge?.engineKnowsNu7 === 'function') {
          setEngineKnowsNu7(
            await bridge.engineKnowsNu7().then(
              (v: unknown) => v === true,
              () => null,
            ),
          );
        }
        if (typeof bridge?.setTorAtStart === 'function') {
          await bridge
            .setTorAtStart(torForServer(getTorWanted(), getServer()))
            .catch(() => {});
        }
        synchronizer = await startWallet(
          {
            networkName: NETWORK,
            defaultHost: server.host,
            defaultPort: server.port,
            alias: WALLET_ALIAS,
            birthdayHeight: wallet.birthdayHeight,
            newWallet: isNew && !startedBefore,
          },
          wallet,
        );
        startedBefore = true;
        if (cancelled) return;
        live.current = synchronizer;
        // The engine fills in some transactions during the first sync after
        // a launch (after a database update by a new engine, for example)
        // without reporting them as found. Ask for the full list once that
        // sync is done, so the history is complete without a restart.
        let resentAfterSync = false;
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
              !settled(prev) &&
              BigInt(next.totalZatoshi) < BigInt(prev.totalZatoshi)
                ? { ...prev, pools }
                : { ...prev, ...next, pools },
            );
          },
          onStatusChanged: status => {
            if (status.name === 'DISCONNECTED') {
              recordSyncProblem(
                `Lost the connection to ${serverLabel(getServer())}`,
              );
            }
            // Reaching the network again clears an earlier connection error.
            patch(
              status.name === 'SYNCED' || status.name === 'SYNCING'
                ? { status: status.name, error: null }
                : { status: status.name },
            );
            if (status.name === 'SYNCED' && !resentAfterSync && !cancelled) {
              resentAfterSync = true;
              const native = NativeModules.RNZcash;
              if (typeof native?.emitExistingTransactions === 'function') {
                native.emitExistingTransactions(WALLET_ALIAS).catch(() => {
                  resentAfterSync = false;
                });
              }
            }
          },
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
            // Syncing moving forward again clears an earlier connection
            // error: the status itself may never change while it catches up.
            setState(prev => {
              const moved = event.scanProgress > prev.scanProgress;
              if (moved) errorSince.current = null;
              return {
                ...prev,
                scanProgress: event.scanProgress,
                networkHeight: event.networkBlockHeight,
                error: moved ? null : prev.error,
              };
            }),
          onError: error => {
            const text = friendlyError(error.message);
            recordSyncProblem(text);
            if (text === SYNC_DROPPED) {
              // Keeps dropping for a few minutes: suggest another server.
              const now = Date.now();
              errorSince.current ??= now;
              patch({
                error:
                  now - errorSince.current > SYNC_DROPPED_TIP_MS
                    ? SYNC_DROPPED_LONG
                    : SYNC_DROPPED,
              });
            } else patch({ error: text });
          },
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
        patch({ error: friendlyError(nativeMessage(e)), startFailed: true });
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
    wallet,
    wallet.birthdayHeight,
    isNew,
    server.host,
    server.port,
    applyTor,
    startAttempt,
  ]);

  // Remember the balance whenever it changes while fully synced.
  const {
    status,
    scanProgress,
    totalZatoshi,
    availableZatoshi,
    spendableZatoshi,
    transparentZatoshi,
  } = state;
  useEffect(() => {
    if (!settled({ status, scanProgress }) || !liveBalance.current) return;
    setState(prev => (prev.everSynced ? prev : { ...prev, everSynced: true }));
    saveLastBalance(wallet.birthdayHeight, {
      totalZatoshi,
      availableZatoshi,
      spendableZatoshi,
      transparentZatoshi,
    });
  }, [
    status,
    scanProgress,
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
    if (nu7Pauses(heightNow.current)) throw new Error(NU7_PAUSED);
    try {
      return await live.current.proposeTransfer(opts);
    } catch (e) {
      throw new Error(friendlyError(nativeMessage(e)));
    }
  }, []);

  const spendable = state.spendableZatoshi;
  const proposeMax = useCallback<Wallet['proposeMax']>(
    async ({ toAddress, memo }) => {
      // Audit C-15: the engine's own send-max proposal, when this build has
      // it: librustzcash works out the fee once, and the amount shown is the
      // one in the payment request the engine built.
      const bridge = NativeModules.RNZcash;
      if (typeof bridge?.proposeSendMax === 'function') {
        if (live.current == null)
          throw new Error('The wallet is still starting');
        let result: ProposalSuccess & { transactionRequest?: string };
        try {
          result = await bridge.proposeSendMax(
            WALLET_ALIAS,
            toAddress,
            memo ?? '',
          );
        } catch (e) {
          throw new Error(friendlyError(nativeMessage(e)));
        }
        const zatoshi = amountInRequest(result.transactionRequest ?? '');
        if (zatoshi == null) {
          throw new Error(
            'Zecky could not read the amount of this payment. Nothing was sent; type the amount instead of Max.',
          );
        }
        return {
          proposal: {
            proposalBase64: result.proposalBase64,
            transactionCount: result.transactionCount,
            totalFee: result.totalFee,
          },
          zatoshi,
        };
      }
      // Older builds: the fee depends on how many notes the payment uses, so
      // start from the minimum fee and adjust until amount plus quoted fee is
      // exactly the spendable balance.
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
    proposalBase64 =>
      oneAtATime(() =>
        release(proposalBase64, {
          walletLive: () => live.current != null,
          hasGrant: hasReleaseGrant,
          nu7Paused: () => nu7Pauses(heightNow.current),
          torBlocks: () => torBlocksRelease(getTorWanted(), torStatus.current),
          isOnline,
          server: getServer,
          canReachHomeNode,
          hasSecurityKeys: async () =>
            (await loadSecurityKeyState()).keys.length > 0,
          checkSecurityKey,
          readSeed,
          createTransfer: (seed, proposal) => {
            if (live.current == null) {
              return Promise.reject(new Error('The wallet is still starting'));
            }
            return live.current.createTransfer({
              mnemonicSeed: seed,
              proposalBase64: proposal,
            });
          },
          recordSent,
          nativeMessage,
        }),
      ),
    [],
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

  const shieldFunds = useCallback<Wallet['shieldFunds']>(
    () =>
      oneAtATime(async () => {
        if (live.current == null)
          throw new Error('The wallet is still starting');
        if (nu7Pauses(heightNow.current)) throw new Error(NU7_PAUSED);
        if (torBlocksRelease(getTorWanted(), torStatus.current)) {
          throw new Error(TOR_NOT_READY);
        }
        let seed: string;
        try {
          seed = await readSeed('Lock in your Zcash');
        } catch (e) {
          if (e instanceof SeedMissingError)
            throw new Error(SEED_MISSING_LOCK_IN);
          throw new Error(SEED_NOT_RELEASED_LOCK_IN);
        }
        if (live.current == null)
          throw new Error('The wallet is still starting');
        try {
          return await live.current.shieldFunds({
            seed,
            memo: '',
            threshold: '10000',
          });
        } catch (e) {
          throw new Error(friendlyError(nativeMessage(e)));
        }
      }),
    [],
  );

  return {
    ...state,
    retryStart,
    proposeTransfer,
    proposeMax,
    sendProposal,
    newShieldedAddress,
    addressUsage,
    shieldFunds,
  };
}
