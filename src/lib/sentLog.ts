import { Platform, Settings } from 'react-native';
import type { Transaction } from 'react-native-zcash';

// When this phone sent each of its payments, and whether delivery to the
// network failed. A failed delivery is not "nothing sent": the payment is
// stored and the Zcash engine retries it every few minutes until it is
// mined or expires. Kept only until the payment is confirmed or expired.
const KEY = 'zecky.sent';

export interface SentEntry {
  at: number;
  waiting: boolean;
}

let log: Record<string, SentEntry> | null = null;

function load(): Record<string, SentEntry> {
  if (log != null) return log;
  log = {};
  try {
    if (Platform.OS === 'ios') {
      const raw = Settings.get(KEY);
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw) as Record<string, SentEntry>;
        for (const [id, entry] of Object.entries(parsed)) {
          if (typeof entry?.at === 'number') {
            log[id] = { at: entry.at, waiting: entry.waiting === true };
          }
        }
      }
    }
  } catch {
    // Start empty.
  }
  return log;
}

function store(): void {
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: JSON.stringify(log) });
  } catch {
    // Kept until the app is closed.
  }
}

export function recordSent(txIds: string[], waiting: boolean): void {
  const current = load();
  const at = Date.now();
  for (const id of txIds) if (id) current[id] = { at, waiting };
  store();
}

export function sentEntry(txId: string): SentEntry | null {
  return load()[txId] ?? null;
}

/** Drops entries for payments that are confirmed or expired. */
export function pruneSent(transactions: Transaction[]): void {
  const current = load();
  let changed = false;
  for (const tx of transactions) {
    if (current[tx.rawTransactionId] && (tx.minedHeight > 0 || tx.isExpired)) {
      delete current[tx.rawTransactionId];
      changed = true;
    }
  }
  if (changed) store();
}

/** For Erase wallet. */
export function clearSent(): void {
  log = {};
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: '{}' });
  } catch {
    // Applies until the app is closed.
  }
}

/** Pulls the txids out of the engine's "txids:a,b" failure message. */
export function txIdsFrom(message: string): string[] {
  const match = /txids:([0-9a-fA-F,]+)/.exec(message);
  return match ? match[1].split(',').filter(Boolean) : [];
}

/** Payments from this phone that are created but not delivered yet. */
export function waitingPayments(transactions: Transaction[]): Transaction[] {
  return transactions.filter(
    tx =>
      tx.minedHeight <= 0 &&
      !tx.isExpired &&
      sentEntry(tx.rawTransactionId)?.waiting === true,
  );
}
