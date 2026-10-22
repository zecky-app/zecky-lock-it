import type { Transaction } from 'react-native-zcash';
import { txKind } from './transactions';

// How long until Zcash that is still confirming can be used. The Zcash
// libraries require 10 confirmations for Zcash that arrives from someone
// else and 3 for the wallet's own change (as in Zodl); a block takes about
// 75 seconds. Worked out from what the engine already reports: the block a
// payment is in and the latest block of the network.

export const CONFIRMATIONS_RECEIVED = 10;
export const CONFIRMATIONS_OWN = 3;
export const BLOCK_SECONDS = 75;

export interface Waiting {
  /** Confirmations so far (0 while not in a block yet). */
  confirmations: number;
  needed: number;
  /** Minutes left, rounded, at least 1. */
  minutes: number;
}

/**
 * The payment that will become usable last, or null when nothing is
 * waiting or the latest block is not known yet.
 */
export function slowestWaiting(
  transactions: Transaction[],
  networkHeight: number,
): Waiting | null {
  if (!(networkHeight > 0)) return null;
  let slowest: (Waiting & { left: number }) | null = null;
  for (const tx of transactions) {
    if (tx.isExpired) continue;
    const needed =
      txKind(tx) === 'received' ? CONFIRMATIONS_RECEIVED : CONFIRMATIONS_OWN;
    const confirmations =
      tx.minedHeight > 0
        ? Math.max(0, Math.min(needed, networkHeight - tx.minedHeight + 1))
        : 0;
    if (confirmations >= needed) continue;
    const left = needed - confirmations;
    if (slowest == null || left > slowest.left) {
      slowest = {
        confirmations,
        needed,
        left,
        minutes: Math.max(1, Math.round((left * BLOCK_SECONDS) / 60)),
      };
    }
  }
  if (slowest == null) return null;
  return {
    confirmations: slowest.confirmations,
    needed: slowest.needed,
    minutes: slowest.minutes,
  };
}

/** "usable in about 6 minutes · 4/10 confirmations" */
export function waitingText(w: Waiting | null): string {
  if (w == null) return 'usable within about 12 minutes';
  const time = w.minutes <= 1 ? 'about a minute' : `about ${w.minutes} minutes`;
  const progress =
    w.confirmations === 0
      ? 'waiting for a block'
      : `${w.confirmations}/${w.needed} confirmations`;
  return `usable in ${time} · ${progress}`;
}
