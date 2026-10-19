import { Platform, Settings } from 'react-native';
import * as Keychain from 'react-native-keychain';

// The private addresses this wallet has handed out, newest first, per
// wallet (keyed by the tail of its default address). They are kept in the
// Keychain on this device only: anyone holding the list could link
// payments to these addresses to you, so it stays out of iCloud and
// computer backups. Earlier builds used app settings; that copy is moved
// over and removed the first time it is read.
import { addOwnAddresses, clearOwnAddresses } from './transactions';
const SERVICE = 'app.zecky.lockit.addresses';

const memory = new Map<string, string[]>();
let loaded: Promise<void> | null = null;
let saving: Promise<unknown> = Promise.resolve();

function keyFor(defaultAddress: string): string {
  return `zecky.addresses.${defaultAddress.slice(-16)}`;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((a): a is string => typeof a === 'string')
    : [];
}

function loadAll(): Promise<void> {
  if (loaded == null) {
    loaded = (async () => {
      try {
        const entry = await Keychain.getGenericPassword({ service: SERVICE });
        if (entry !== false) {
          const all = JSON.parse(entry.password) as Record<string, unknown>;
          for (const [key, list] of Object.entries(all)) {
            memory.set(key, strings(list));
          }
        }
      } catch {
        // Nothing readable stored yet.
      }
    })();
  }
  return loaded;
}

function persist(): void {
  const data = JSON.stringify(Object.fromEntries(memory));
  saving = saving
    .catch(() => {})
    .then(() =>
      Keychain.setGenericPassword('addresses', data, {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }),
    )
    .catch(() => {});
}

function takeLegacy(key: string): string[] {
  if (Platform.OS !== 'ios') return [];
  try {
    const list = strings(Settings.get(key));
    if (list.length > 0) Settings.set({ [key]: [] });
    return list;
  } catch {
    return [];
  }
}

export async function loadAddresses(defaultAddress: string): Promise<string[]> {
  await loadAll();
  addOwnAddresses([defaultAddress]);
  const key = keyFor(defaultAddress);
  const legacy = takeLegacy(key);
  if (legacy.length > 0) {
    const current = memory.get(key) ?? [];
    memory.set(key, [...current, ...legacy.filter(a => !current.includes(a))]);
    persist();
  }
  const list = memory.get(key) ?? [];
  addOwnAddresses(list);
  return list;
}

export function saveAddresses(defaultAddress: string, list: string[]): void {
  addOwnAddresses(list);
  memory.set(keyFor(defaultAddress), list);
  persist();
}

/** Removes every saved list, for Erase wallet. */
export function clearAddresses(defaultAddress: string | null): void {
  memory.clear();
  clearOwnAddresses();
  if (defaultAddress != null) takeLegacy(keyFor(defaultAddress));
  saving = saving
    .catch(() => {})
    .then(() => Keychain.resetGenericPassword({ service: SERVICE }))
    .catch(() => {});
}

/**
 * The full list shown to the user: generated addresses newest first, with
 * the wallet's default address always present at the end.
 */
export function withDefault(list: string[], defaultAddress: string): string[] {
  const unique = [...new Set(list)].filter(a => a !== defaultAddress);
  return [...unique, defaultAddress];
}

/**
 * Adds private addresses the wallet has been paid on but that are missing
 * from the saved list, for example ones handed out before a restore or by an
 * earlier version of the app. Returns the same array when nothing is missing.
 */
export function withDiscovered(
  list: string[],
  usage: Record<string, number>,
  defaultAddress: string,
): string[] {
  const missing = Object.keys(usage).filter(
    address =>
      address.startsWith('u') &&
      address !== defaultAddress &&
      !list.includes(address),
  );
  return missing.length === 0 ? list : [...list, ...missing];
}
