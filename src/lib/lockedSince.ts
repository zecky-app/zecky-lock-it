import type { Transaction } from 'react-native-zcash';
import { txKind } from './transactions';

/**
 * When the current holding began, as on the Mac: the first confirmed
 * payment in, counted again from the next payment in if the wallet was
 * ever completely emptied. Null when nothing is locked.
 */
export function lockedSince(transactions: Transaction[]): Date | null {
  const confirmed = transactions
    .filter(tx => tx.minedHeight > 0 && !tx.isExpired)
    .sort(
      (a, b) =>
        a.minedHeight - b.minedHeight ||
        a.blockTimeInSeconds - b.blockTimeInSeconds,
    );
  let running = 0n;
  let since: Date | null = null;
  for (const tx of confirmed) {
    const value = BigInt(tx.value || '0');
    const fee = BigInt(tx.fee || '0');
    switch (txKind(tx)) {
      case 'received':
        if (running <= 0n) since = new Date(tx.blockTimeInSeconds * 1000);
        running += value;
        break;
      case 'sent':
        running -= value + fee;
        break;
      default:
        // To yourself or shielding: only the fee leaves.
        running -= fee;
    }
    if (running <= 0n) {
      running = 0n;
      since = null;
    }
  }
  return since;
}

/** Calendar days, so a payment from yesterday evening counts as 1 day. */
export function daysSince(since: Date, now: Date = new Date()): number {
  const start = new Date(
    since.getFullYear(),
    since.getMonth(),
    since.getDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(
    0,
    Math.round((today.getTime() - start.getTime()) / 86_400_000),
  );
}
