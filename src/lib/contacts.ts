import { useEffect, useSyncExternalStore } from 'react';
import * as Keychain from 'react-native-keychain';

export interface Contact {
  id: string;
  name: string;
  address: string;
}

// Who you pay is private, so contacts live in the Keychain on this device
// only: not in backups, not in iCloud.
const SERVICE = 'app.zecky.lockit.contacts';

let contacts: Contact[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function sortContacts(list: Contact[]): Contact[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
}

function parse(json: string): Contact[] {
  try {
    const data: unknown = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (c): c is Contact =>
        c != null &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        typeof c.address === 'string',
    );
  } catch {
    return [];
  }
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const entry = await Keychain.getGenericPassword({ service: SERVICE });
    if (entry !== false) {
      contacts = sortContacts(parse(entry.password));
      notify();
    }
  } catch {
    // No contacts available; the list just stays empty.
  }
}

async function save(next: Contact[]): Promise<void> {
  const result = await Keychain.setGenericPassword(
    'contacts',
    JSON.stringify(next),
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (result === false) throw new Error('Could not save the contact');
  contacts = next;
  notify();
}

export async function addContact(name: string, address: string): Promise<void> {
  await load();
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const cleaned = { id, name: name.trim(), address: address.trim() };
  await save(
    sortContacts([
      ...contacts.filter(c => c.address !== cleaned.address),
      cleaned,
    ]),
  );
}

export async function removeContact(id: string): Promise<void> {
  await load();
  await save(contacts.filter(c => c.id !== id));
}

export function contactName(list: Contact[], address: string): string | null {
  return list.find(c => c.address === address.trim())?.name ?? null;
}

export function useContacts(): Contact[] {
  useEffect(() => {
    load();
  }, []);
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => contacts,
  );
}

/** Removes every contact from this phone. */
export async function clearContacts(): Promise<void> {
  loaded = true;
  await Keychain.resetGenericPassword({ service: SERVICE });
  contacts = [];
  notify();
}
