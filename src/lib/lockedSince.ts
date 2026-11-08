import type { Transaction } from 'react-native-zcash';
import { isOwnAddress } from './transactions';

/**
 * The change a transaction made to this wallet's balance, in zatoshi. The
 * engine reports the size without a sign (and a send already includes its
 * fee); `isSent` says which way it went. Older entries without `isSent` fall
 * back to "names a recipient, so it was sent".
 */
function balanceChange(tx: Transaction): bigint {
  const size = BigInt(tx.value || '0');
  const sent = tx.isSent ?? (tx.toAddress != null && tx.toAddress !== '');
  return sent || tx.isShielding ? -size : size;
}

/**
 * An internal move (locking in transparent Zcash, the Ironwood move, a
 * payment to an own address): money stays in the lock, only the fee leaves.
 * It never starts or restarts the count.
 */
function isInternal(tx: Transaction): boolean {
  if (tx.isShielding) return true;
  const sent = tx.isSent ?? (tx.toAddress != null && tx.toAddress !== '');
  return (
    sent &&
    (tx.toAddress == null || tx.toAddress === '' || isOwnAddress(tx.toAddress))
  );
}

/** One stretch of holding: from a payment in after an empty lock until it was empty again. */
export interface Stretch {
  start: Date;
  /** When the lock was empty again; null for the stretch going on now. */
  end: Date | null;
  /** Zatoshi that came in during the stretch (payments in, not internal moves). */
  received: bigint;
  /** How many payments came in. */
  paymentsIn: number;
  /** The largest single payment in, with when it came. */
  largest: { zatoshi: bigint; at: Date } | null;
}

/**
 * Every stretch of holding, oldest first, worked out from the wallet
 * history alone (no stored timer, so it comes back the same after a
 * restore). A stretch starts at the first confirmed payment in after the
 * balance was zero; sends of any size and later payments in do not end it,
 * internal moves count as nothing; only an empty lock ends it.
 */
export function stretches(transactions: Transaction[]): Stretch[] {
  return walk(transactions).list;
}

function walk(transactions: Transaction[]): {
  list: Stretch[];
  balance: bigint;
} {
  const confirmed = transactions
    .filter(tx => tx.minedHeight > 0 && !tx.isExpired)
    .sort(
      (a, b) =>
        a.minedHeight - b.minedHeight ||
        a.blockTimeInSeconds - b.blockTimeInSeconds,
    );
  const list: Stretch[] = [];
  let balance = 0n;
  let current: Stretch | null = null;
  for (const tx of confirmed) {
    const change = balanceChange(tx);
    const at = new Date(tx.blockTimeInSeconds * 1000);
    const paymentIn = change > 0n && !isInternal(tx);
    if (current == null && balance <= 0n && paymentIn) {
      current = {
        start: at,
        end: null,
        received: 0n,
        paymentsIn: 0,
        largest: null,
      };
      list.push(current);
    }
    if (current != null && paymentIn) {
      current.received += change;
      current.paymentsIn += 1;
      if (current.largest == null || change > current.largest.zatoshi) {
        current.largest = { zatoshi: change, at };
      }
    }
    balance += change;
    if (balance <= 0n) {
      balance = 0n;
      if (current != null) current.end = at;
      current = null;
    }
  }
  return { list, balance };
}

/**
 * Whether the history reaches back to the start of what is in the lock.
 * After a restore from a later date the oldest payments in are missing:
 * then the confirmed history adds up to less than the balance (minus what
 * is still waiting to come in), and a count from it would be too short.
 */
export function historyComplete(
  transactions: Transaction[],
  balanceZatoshi: string,
): boolean {
  const pendingIn = transactions
    .filter(tx => tx.minedHeight <= 0 && !tx.isExpired)
    .reduce((sum, tx) => {
      const change = balanceChange(tx);
      return change > 0n ? sum + change : sum;
    }, 0n);
  return walk(transactions).balance + pendingIn >= BigInt(balanceZatoshi);
}

/**
 * When the current holding began: the start of the stretch going on now.
 * Null when nothing is in the lock.
 */
export function lockedSince(transactions: Transaction[]): Date | null {
  const last = stretches(transactions).pop();
  return last != null && last.end == null ? last.start : null;
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

const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * How long, in the largest whole unit only and never as a date (a date was
 * read as an unlock date): days up to 6, weeks from 7 to 29 days, months
 * (of 30 days, at most 11) up to 364 days, then years of 365 days.
 */
export function heldFor(days: number): string {
  const d = Math.max(0, Math.floor(days));
  if (d < 1) return 'since today';
  if (d < 7) return `for ${unit(d, 'day')}`;
  if (d < 30) return `for ${unit(Math.floor(d / 7), 'week')}`;
  if (d < 365) return `for ${unit(Math.min(11, Math.floor(d / 30)), 'month')}`;
  return `for ${unit(Math.floor(d / 365), 'year')}`;
}
