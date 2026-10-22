import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';

// How long "Really open the lock?" makes you wait, in seconds. 0 means no
// question at all: tapping the lock goes straight to the app code or
// Face ID, which is always asked.
const KEY = 'zecky.openWait';

export const OPEN_WAITS = [10, 5, 3, 0] as const;
export type OpenWait = (typeof OPEN_WAITS)[number];
export const DEFAULT_OPEN_WAIT: OpenWait = 10;

/** Anything stored that is not one of the choices counts as the default. */
export function toOpenWait(stored: unknown): OpenWait {
  return (OPEN_WAITS as readonly unknown[]).includes(stored)
    ? (stored as OpenWait)
    : DEFAULT_OPEN_WAIT;
}

function load(): OpenWait {
  try {
    if (Platform.OS === 'ios') return toOpenWait(Settings.get(KEY));
  } catch {
    // Fall through to the default.
  }
  return DEFAULT_OPEN_WAIT;
}

let current: OpenWait | null = null;
const listeners = new Set<() => void>();

export function getOpenWait(): OpenWait {
  return (current ??= load());
}

export function setOpenWait(next: OpenWait): void {
  current = next;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: next });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

/** Back to the default, for Erase wallet. */
export function resetOpenWait(): void {
  setOpenWait(DEFAULT_OPEN_WAIT);
}

export function useOpenWait(): OpenWait {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getOpenWait);
}
