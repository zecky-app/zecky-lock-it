import * as Keychain from 'react-native-keychain';

// The last balance the wallet reported while fully synced. Zecky shows it
// while the wallet starts, syncs or has no connection, instead of 0. Like
// the address list, it is kept in the Keychain on this device only, out of
// iCloud and computer backups.
const SERVICE = 'app.zecky.lockit.balance';

export interface Balances {
  totalZatoshi: string;
  availableZatoshi: string;
  spendableZatoshi: string;
  transparentZatoshi: string;
}

const FIELDS = [
  'totalZatoshi',
  'availableZatoshi',
  'spendableZatoshi',
  'transparentZatoshi',
] as const;

const isZats = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);

let saving: Promise<unknown> = Promise.resolve();
let lastSaved: string | null = null;

/**
 * The saved balance, or null when there is none for this wallet. The
 * birthday height is a simple check that it belongs to the same wallet.
 */
export async function loadLastBalance(
  birthdayHeight: number,
): Promise<Balances | null> {
  try {
    await saving.catch(() => {});
    const entry = await Keychain.getGenericPassword({ service: SERVICE });
    if (entry === false) return null;
    const data = JSON.parse(entry.password) as Record<string, unknown>;
    if (data.birthdayHeight !== birthdayHeight) return null;
    const balances = {} as Balances;
    for (const field of FIELDS) {
      const value = data[field];
      if (!isZats(value)) return null;
      balances[field] = value;
    }
    return balances;
  } catch {
    return null;
  }
}

export function saveLastBalance(
  birthdayHeight: number,
  balances: Balances,
): void {
  const data = JSON.stringify({
    birthdayHeight,
    totalZatoshi: balances.totalZatoshi,
    availableZatoshi: balances.availableZatoshi,
    spendableZatoshi: balances.spendableZatoshi,
    transparentZatoshi: balances.transparentZatoshi,
  });
  if (data === lastSaved) return;
  lastSaved = data;
  saving = saving
    .catch(() => {})
    .then(() =>
      Keychain.setGenericPassword('balance', data, {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    )
    .catch(() => {});
}

/** Removes the saved balance, for Erase wallet. */
export function clearLastBalance(): Promise<void> {
  lastSaved = null;
  saving = saving
    .catch(() => {})
    .then(() => Keychain.resetGenericPassword({ service: SERVICE }))
    .catch(() => {});
  return saving.then(() => {});
}
