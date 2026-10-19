import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';

// Whether the user wants Tor. Off by default: it is slower and some
// networks block it.
const KEY = 'zecky.tor';

/** What the wallet is actually doing right now. */
export type TorStatus = 'off' | 'starting' | 'on' | 'failed' | 'unavailable';

function load(): boolean {
  try {
    if (Platform.OS === 'ios') {
      const stored = Settings.get(KEY);
      return stored === true || stored === 1;
    }
  } catch {
    // Fall through to off.
  }
  return false;
}

let wanted: boolean | null = null;
const listeners = new Set<() => void>();

export function getTorWanted(): boolean {
  return (wanted ??= load());
}

export function setTorWanted(next: boolean): void {
  wanted = next;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: next });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

/** Back to the default (off), for Erase wallet. */
export function resetTor(): void {
  wanted = false;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: false });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

export function useTorWanted(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getTorWanted);
}
