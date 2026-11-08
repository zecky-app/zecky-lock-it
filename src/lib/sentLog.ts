import { Platform, Settings } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { Transaction } from 'react-native-zcash';

// When this phone sent each of its payments, and whether delivery to the
// network failed. A failed delivery is not "nothing sent": the payment is
// stored and the Zcash engine retries it every few minutes until it is
// mined or expires. Kept only until the payment is confirmed or expired.
// Audit C-29: the txids link this phone to its own payments on the chain,
// so the log lives in a this-device-only Keychain item, not in the app
// settings (those go into iCloud and computer backups). The old settings
// copy is moved over once and then emptied.
const KEY = 'zecky.sent';
const SERVICE = 'app.zecky.lockit.sent';

export interface SentEntry {
  at: number;
  waiting: boolean;
}

let log: Record<string, SentEntry> | null = null;

function parseLog(raw: unknown, into: Record<string, SentEntry>): void {
  if (typeof raw !== 'string') return;
  try {
    const parsed = JSON.parse(raw) as Record<string, SentEntry>;
    for (const [id, entry] of Object.entries(parsed)) {
      if (typeof entry?.at === 'number') {
        into[id] = { at: entry.at, waiting: entry.waiting === true };
      }
    }
  } catch {
    // Skip what cannot be read.
  }
}

function load(): Record<string, SentEntry> {
  if (log == null) log = {};
  return log;
}

/** Call once at startup, before the wallet opens. */
export async function loadSentLog(): Promise<void> {
  const current = load();
  try {
    const entry = await Keychain.getGenericPassword({ service: SERVICE });
    if (entry) parseLog(entry.password, current);
  } catch {
    // Start from what is in memory.
  }
  // Move the copy from builds before the audit out of the app settings.
  let moved = false;
  try {
    if (Platform.OS === 'ios') {
      const old = Settings.get(KEY);
      if (typeof old === 'string' && old !== '{}') {
        parseLog(old, current);
        moved = true;
      }
    }
  } catch {
    // Nothing to move.
  }
  if (moved) {
    await persist();
    try {
      Settings.set({ [KEY]: null });
    } catch {
      // Tried again at the next start.
    }
  }
}

async function persist(): Promise<void> {
  try {
    await Keychain.setGenericPassword('sent', JSON.stringify(log ?? {}), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // Kept in memory until the app is closed.
  }
}

function store(): void {
  persist();
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
  Keychain.resetGenericPassword({ service: SERVICE }).catch(() => false);
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: null });
  } catch {
    // Applies until the app is closed.
  }
}

/** Pulls the txids out of the engine's "txids:a,b" failure message. */
export function txIdsFrom(message: string): string[] {
  const match = /txids:([0-9a-fA-F,]+)/.exec(message);
  return match ? match[1].split(',').filter(Boolean) : [];
}

/**
 * The engine's own reason after "detail:" (or after the txids for a
 * rejection), so "Release saved" can say why (self-audit N6).
 */
export function detailFrom(message: string): string | null {
  const detail = /detail:([\s\S]+)$/.exec(message);
  if (detail) return detail[1].trim();
  const rejected = /txids:[0-9a-fA-F,]+\s+([\s\S]+)$/.exec(message);
  return rejected ? rejected[1].trim() : null;
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
