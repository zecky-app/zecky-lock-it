import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';

// "Before you start": shown once before creating or restoring a wallet,
// and again only when the terms change. Raise TERMS_VERSION whenever
// zecky.app/terms.html changes in a way people should see again. Only the
// accepted version and the day are kept, in the app's own settings on this
// phone; nothing is sent anywhere. Erase wallet keeps it: it is about the
// person, not the wallet. Deleting the app removes it.
export const TERMS_VERSION = 1;

const KEY = 'zecky.terms.accepted';

interface Accepted {
  version: number;
  /** The day it was accepted, YYYY-MM-DD. */
  on: string;
}

function load(): Accepted | null {
  try {
    if (Platform.OS !== 'ios') return null;
    const stored = Settings.get(KEY);
    if (typeof stored !== 'string') return null;
    const parsed = JSON.parse(stored) as Partial<Accepted>;
    return typeof parsed.version === 'number' && typeof parsed.on === 'string'
      ? { version: parsed.version, on: parsed.on }
      : null;
  } catch {
    // Unreadable: show the screen once more, which is harmless.
    return null;
  }
}

let accepted: Accepted | null | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

/** True when the current terms version has been accepted on this phone. */
export function termsAccepted(): boolean {
  if (accepted === undefined) accepted = load();
  return accepted != null && accepted.version >= TERMS_VERSION;
}

export function acceptTerms(now: Date = new Date()): void {
  accepted = { version: TERMS_VERSION, on: now.toISOString().slice(0, 10) };
  try {
    if (Platform.OS === 'ios')
      Settings.set({ [KEY]: JSON.stringify(accepted) });
  } catch {
    // Accepted for this session only; asked again next time.
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTermsAccepted(): boolean {
  return useSyncExternalStore(subscribe, termsAccepted);
}
