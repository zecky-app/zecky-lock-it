import { useSyncExternalStore } from 'react';
import { Platform, Settings } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// The check that the recovery phrase really is on paper: three of the 24
// words, each picked from four choices.

export interface PhraseQuestion {
  /** Position in the phrase, counted from 1. */
  position: number;
  answer: string;
  choices: string[];
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Three questions in phrase order. The wrong choices are words that do not
 * appear anywhere in the phrase, so a look at the paper always settles it.
 */
export function makeQuestions(
  mnemonic: string,
  random: () => number = Math.random,
): PhraseQuestion[] {
  const words = mnemonic.split(' ');
  const positions = shuffled(
    words.map((_, i) => i),
    random,
  )
    .slice(0, 3)
    .sort((a, b) => a - b);
  const own = new Set(words);
  return positions.map(i => {
    const decoys: string[] = [];
    while (decoys.length < 3) {
      const candidate = wordlist[Math.floor(random() * wordlist.length)];
      if (!own.has(candidate) && !decoys.includes(candidate)) {
        decoys.push(candidate);
      }
    }
    return {
      position: i + 1,
      answer: words[i],
      choices: shuffled([words[i], ...decoys], random),
    };
  });
}

export function allCorrect(
  questions: PhraseQuestion[],
  picked: (string | null)[],
): boolean {
  return questions.every((q, i) => picked[i] === q.answer);
}

// Remembered only when someone chose "Later" on a new wallet. Restored
// wallets never set it: typing the words in already proved they have them.
const KEY = 'zecky.phraseUnconfirmed';

function read(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const stored = Settings.get(KEY);
    return stored === true || stored === 1;
  } catch {
    return false;
  }
}

let unconfirmed = read();
const listeners = new Set<() => void>();

// Also kept in the Keychain, next to the phrase itself: deleting and
// reinstalling the app brings the wallet back, and the reminder with it.
const SERVICE = 'app.zecky.lockit.phrasestate';

function notify(): void {
  listeners.forEach(listener => listener());
}

/** Reads the Keychain copy at startup. */
export async function loadPhraseState(): Promise<void> {
  try {
    const entry = await Keychain.getGenericPassword({ service: SERVICE });
    const stored = entry !== false && entry.password === 'unconfirmed';
    if (stored !== unconfirmed) {
      unconfirmed = stored;
      notify();
    }
  } catch {
    // Keep what the settings store said.
  }
}

export function setPhraseUnconfirmed(value: boolean): void {
  unconfirmed = value;
  (value
    ? Keychain.setGenericPassword('zecky', 'unconfirmed', {
        service: SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
    : Keychain.resetGenericPassword({ service: SERVICE })
  ).catch(() => {});
  if (Platform.OS === 'ios') {
    try {
      Settings.set({ [KEY]: value });
    } catch {
      // Kept for this session only.
    }
  }
  notify();
}

export function usePhraseUnconfirmed(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unconfirmed,
  );
}
