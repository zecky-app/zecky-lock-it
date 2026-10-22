import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';

// Keys to the lock: when Zecky checks it is you, with the Zecky code or
// else Face ID / the iPhone passcode. Showing the recovery phrase and
// erasing the wallet always ask; these two can be switched off.
//
// Opening Zecky: on by default with a Zecky code (as it always was) and
// off without one, until the user chooses. Opening the lock: on.

export type AskMoment = 'start' | 'openLock';

const KEYS: Record<AskMoment, string> = {
  start: 'zecky.ask.start',
  openLock: 'zecky.ask.openLock',
};

/** Stored choice, or null when the user never chose. */
function load(moment: AskMoment): boolean | null {
  try {
    if (Platform.OS === 'ios') {
      const stored = Settings.get(KEYS[moment]);
      if (stored === true || stored === 1) return true;
      if (stored === false || stored === 0) return false;
    }
  } catch {
    // Fall through to the default.
  }
  return null;
}

const chosen: Record<AskMoment, boolean | null | undefined> = {
  start: undefined,
  openLock: undefined,
};
const listeners = new Set<() => void>();

function choice(moment: AskMoment): boolean | null {
  if (chosen[moment] === undefined) chosen[moment] = load(moment);
  return chosen[moment] ?? null;
}

/** Whether to ask at this moment, given whether a Zecky code is set. */
export function asksAt(moment: AskMoment, codeSet: boolean): boolean {
  const value = choice(moment);
  if (value != null) return value;
  return moment === 'start' ? codeSet : true;
}

export function setAskAt(moment: AskMoment, ask: boolean): void {
  chosen[moment] = ask;
  try {
    if (Platform.OS === 'ios') Settings.set({ [KEYS[moment]]: ask });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

/** Back to the defaults, for Erase wallet. */
export function resetAskWhen(): void {
  (Object.keys(KEYS) as AskMoment[]).forEach(moment => {
    chosen[moment] = null;
    try {
      if (Platform.OS === 'ios') Settings.set({ [KEYS[moment]]: null });
    } catch {
      // Applies until the app is closed.
    }
  });
  listeners.forEach(listener => listener());
}

let version = 0;
listeners.add(() => {
  version += 1;
});

/** Re-renders when a choice changes; read the values with asksAt. */
export function useAskWhen(): number {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
}
