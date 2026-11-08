import {
  friendlyError,
  HOME_NODE_SEND,
  LOCK_NOT_OPEN,
  NU7_PAUSED,
  OFFLINE_SEND,
  paymentSavedError,
  SEED_MISSING,
  SEED_NOT_RELEASED,
  SEND_PENDING,
  SEND_REJECTED,
  SERVER_CHANGED_SEND,
  TOR_NOT_READY,
} from '../lib/errors';
import { detailFrom, txIdsFrom } from '../lib/sentLog';
import { isHomeNode, sameServer, Server } from '../lib/server';
import { SeedMissingError } from './seed';

// Audit C-36: every check a release passes, in order, as a plain function,
// so each branch is tested with fakes (__tests__/release.test.ts). The
// wallet hook only supplies the real dependencies.

const STARTING = 'The wallet is still starting';

export interface ReleaseDeps {
  /** Whether the engine is running. */
  walletLive: () => boolean;
  /** The open lock's grant (audit C-09). */
  hasGrant: () => boolean;
  /** NU7 pause for an engine that does not know NU7. */
  nu7Paused: () => boolean;
  /** Tor wanted but not connected. */
  torBlocks: () => boolean;
  isOnline: () => Promise<boolean>;
  server: () => Server;
  canReachHomeNode: (server: Server) => Promise<boolean>;
  hasSecurityKeys: () => Promise<boolean>;
  /** Asks a tap of a paired key; throws when it fails. */
  checkSecurityKey: () => Promise<unknown>;
  /** The phrase, after Face ID or the passcode; throws when cancelled. */
  readSeed: (reason: string) => Promise<string>;
  createTransfer: (
    seed: string,
    proposalBase64: string,
  ) => Promise<string | { errorMessage?: string }>;
  recordSent: (txIds: string[], waiting: boolean) => void;
  nativeMessage: (e: unknown) => string;
}

/** Releases one proposal. Resolves with the txid; throws a plain message. */
export async function release(
  proposalBase64: string,
  d: ReleaseDeps,
): Promise<string> {
  if (!d.walletLive()) throw new Error(STARTING);
  // Audit C-09: only through an open lock (its code, Face ID and wait).
  if (!d.hasGrant()) throw new Error(LOCK_NOT_OPEN);
  // NU7: an engine that does not know NU7 builds nothing.
  if (d.nu7Paused()) throw new Error(NU7_PAUSED);
  if (d.torBlocks()) throw new Error(TOR_NOT_READY);
  // Offline, nothing is created at all.
  if (!(await d.isOnline())) throw new Error(OFFLINE_SEND);
  const current = d.server();
  if (isHomeNode(current) && !(await d.canReachHomeNode(current))) {
    throw new Error(HOME_NODE_SEND);
  }
  // Keys to the lock ④: with a security key added, releasing asks a tap of
  // one of them, right before the transfer. Throws SecurityKeyError.
  if (await d.hasSecurityKeys()) {
    await d.checkSecurityKey();
    // Waiting for the tap can take a while: check again that nothing
    // changed in between (re-check R7).
    if (!d.walletLive()) throw new Error(STARTING);
    if (!d.hasGrant()) throw new Error(LOCK_NOT_OPEN);
    if (d.torBlocks()) throw new Error(TOR_NOT_READY);
    if (!sameServer(d.server(), current)) {
      throw new Error(SERVER_CHANGED_SEND);
    }
  }
  // Self-audit K1: the phrase comes out of the Secure Enclave only now,
  // after Face ID or the passcode, for this one payment.
  let seed: string;
  try {
    seed = await d.readSeed('Send Zcash');
  } catch (e) {
    if (e instanceof SeedMissingError) throw new Error(SEED_MISSING);
    throw new Error(SEED_NOT_RELEASED);
  }
  if (!d.walletLive()) throw new Error(STARTING);
  let result;
  try {
    result = await d.createTransfer(seed, proposalBase64);
  } catch (e) {
    // Created but not delivered: the engine retries it by itself, so the
    // person must not send it again.
    const code = (e as { code?: string })?.code;
    const message = d.nativeMessage(e);
    const ids = txIdsFrom(message);
    if (code === 'SubmitPending' || code === 'SubmitRejected' || ids.length) {
      d.recordSent(ids, true);
      throw paymentSavedError(
        code === 'SubmitRejected' ? SEND_REJECTED : SEND_PENDING,
        detailFrom(message),
      );
    }
    throw new Error(friendlyError(message));
  }
  if (typeof result !== 'string') {
    throw new Error(result.errorMessage ?? 'The transaction failed');
  }
  d.recordSent([result], false);
  return result;
}
