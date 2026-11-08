import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';

// The short first-run tour: shown once, skippable, and replayable from
// How Zecky works. Only a "seen" flag is kept, in the app's own settings.

const KEY = 'zecky.tour.seen';

function load(): boolean {
  try {
    if (Platform.OS === 'ios') {
      const stored = Settings.get(KEY);
      return stored === true || stored === 1;
    }
  } catch {
    // Not seen: showing it once more is harmless.
  }
  return false;
}

let seen: boolean | undefined;
/** True while the tour should be on screen. */
let showing = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function tourSeen(): boolean {
  if (seen === undefined) seen = load();
  return seen;
}

/** Shows the tour now: the first time, or again from How Zecky works. */
export function showTour(): void {
  showing = true;
  notify();
}

/** Closes the tour (Skip or Done) and remembers that it was seen. */
export function finishTour(): void {
  showing = false;
  seen = true;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: true });
  } catch {
    // Seen for this session only.
  }
  notify();
}

/** For Erase wallet: the next wallet sees the tour once more. */
export function resetTour(): void {
  seen = false;
  showing = false;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEY]: null });
  } catch {
    // Applies until the app is closed.
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTourShowing(): boolean {
  return useSyncExternalStore(subscribe, () => showing);
}
