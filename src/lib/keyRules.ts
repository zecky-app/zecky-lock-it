// The rules around security keys, kept apart from the screens so they can
// be tested. See How Zecky works › Keys to the lock.

import { blocksForSeconds } from './upgrades';

/** 48 hours of Zcash blocks before NU7 (one block about every 75 seconds). */
export const REMOVAL_BLOCKS = 2304;
/** 48 hours on the phone's clock. */
export const REMOVAL_MS = 48 * 60 * 60 * 1000;

/**
 * 48 hours of blocks from this start height: 2,304 before NU7, 6,912
 * after it (25-second blocks), and a mix when the 48 hours span NU7.
 */
export function removalBlocksFrom(startHeight: number): number {
  return blocksForSeconds(startHeight, REMOVAL_MS / 1000);
}

/**
 * "Lost my keys": a removal of every security key that only takes effect
 * once both the Zcash network and the phone's clock show 48 hours. Setting
 * the phone's date forward alone does not shorten it.
 */
export interface KeyRemoval {
  /** ISO time it was started. */
  startedAt: string;
  /** Zcash block height when it was started. */
  startHeight: number;
}

/**
 * Where a removal starts counting blocks from: never below the highest
 * height Zecky has seen while fully synced, so a server that reports a
 * lower height cannot shorten the wait (re-check R1). Returns null when the
 * reported height is clearly behind what Zecky has seen: then the server
 * is not trusted to start one.
 */
export function removalStartHeight(
  syncedHeight: number,
  heightSeen: number,
): number | null {
  if (syncedHeight <= 0) return null;
  if (heightSeen > 0 && syncedHeight < heightSeen - BEHIND_TOLERANCE) {
    return null;
  }
  return Math.max(syncedHeight, heightSeen);
}

/** A server may lag a few blocks behind another; more than this is suspect. */
export const BEHIND_TOLERANCE = 10;

export function removalEndsAt(removal: KeyRemoval): Date {
  return new Date(new Date(removal.startedAt).getTime() + REMOVAL_MS);
}

export function removalDue(
  removal: KeyRemoval | null,
  nowMs: number,
  networkHeight: number,
): boolean {
  if (removal == null) return false;
  const started = new Date(removal.startedAt).getTime();
  if (!Number.isFinite(started) || removal.startHeight <= 0) return false;
  return (
    nowMs >= started + REMOVAL_MS &&
    networkHeight >=
      removal.startHeight + removalBlocksFrom(removal.startHeight)
  );
}

export type KeyAction =
  | 'addFirst'
  | 'addMore'
  | 'remove'
  | 'phraseOn'
  | 'phraseOff'
  | 'startRemoval'
  | 'cancelRemoval'
  | 'test';

/**
 * What an action on the security keys asks first.
 * - 'key': a tap of one of the paired keys
 * - 'owner': the Zecky code, or else Face ID / the iPhone passcode
 * - 'none': nothing
 * Anything that weakens the keys asks a key, so someone who knows the
 * phone's passcode cannot simply take the keys away. A new key also asks
 * an existing one: otherwise someone could add their own key and use it
 * to remove yours. The only way around a key is the 48-hour removal.
 */
export function keyActionAsks(
  action: KeyAction,
  keyCount: number,
): 'key' | 'owner' | 'none' {
  switch (action) {
    case 'addFirst':
    case 'startRemoval':
      return 'owner';
    case 'addMore':
    case 'remove':
    case 'phraseOff':
    case 'cancelRemoval':
      return keyCount > 0 ? 'key' : 'owner';
    case 'phraseOn':
    case 'test':
      return 'none';
  }
}

/** Asking the key for the phrase needs a backup key first. */
export const PHRASE_KEY_MIN_KEYS = 2;
