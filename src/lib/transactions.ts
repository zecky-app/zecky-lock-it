import type { Transaction } from 'react-native-zcash';

export type TxKind = 'received' | 'sent' | 'self' | 'shielded';

// This wallet's own addresses (default, transparent and every handed-out
// receive address), so a payment to one of them shows as "to yourself".
const ownAddresses = new Set<string>();

export function addOwnAddresses(list: (string | null | undefined)[]): void {
  for (const address of list) if (address) ownAddresses.add(address);
}

/** Whether `address` is one of this wallet's own addresses. */
export function isOwnAddress(address: string): boolean {
  return ownAddresses.has(address.trim());
}

/** For Erase wallet. */
export function clearOwnAddresses(): void {
  ownAddresses.clear();
}

/**
 * The SDK reports amounts without a sign. A transaction that names a
 * recipient is one this wallet sent; to one of its own addresses, it only
 * cost the fee.
 */
export function txKind(tx: Transaction): TxKind {
  if (tx.isShielding) return 'shielded';
  if (tx.toAddress == null || tx.toAddress === '') return 'received';
  return ownAddresses.has(tx.toAddress) ? 'self' : 'sent';
}

export function isPending(tx: Transaction): boolean {
  return tx.minedHeight <= 0 && !tx.isExpired;
}

/**
 * The SDK sends transactions in batches (new ones, and ones whose state
 * changed), so each batch is merged into what we already have.
 * Result is newest first, with unconfirmed transactions on top.
 */
export function mergeTransactions(
  existing: Transaction[],
  incoming: Transaction[],
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const tx of existing) byId.set(tx.rawTransactionId, tx);
  for (const tx of incoming) byId.set(tx.rawTransactionId, tx);
  const rank = (tx: Transaction) =>
    tx.minedHeight > 0 ? tx.minedHeight : Number.MAX_SAFE_INTEGER;
  return [...byId.values()].sort(
    (a, b) => rank(b) - rank(a) || b.blockTimeInSeconds - a.blockTimeInSeconds,
  );
}

// A received payment this small costs more in fees to spend than it is
// worth, so the Zcash engine leaves it out of the balance.
const DUST_LIMIT = 5_000n;

/** Received payments too small to count, for explaining the balance. */
export function uncountedDust(transactions: Transaction[]): {
  count: number;
  zatoshi: string;
} {
  let count = 0;
  let total = 0n;
  for (const tx of transactions) {
    if (txKind(tx) !== 'received' || tx.isExpired) continue;
    const value = BigInt(tx.value);
    if (value > 0n && value <= DUST_LIMIT) {
      count += 1;
      total += value;
    }
  }
  return { count, zatoshi: total.toString() };
}

/** True for a received payment too small to be counted in the balance. */
export function isDust(tx: Transaction): boolean {
  if (txKind(tx) !== 'received' || tx.isExpired) return false;
  const value = BigInt(tx.value);
  return value > 0n && value <= DUST_LIMIT;
}
