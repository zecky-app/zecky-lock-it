import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { secureEntropy } from '../wallet/entropy';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// The app code is never stored itself: only a salted, stretched hash of it,
// kept in the Keychain next to (but separate from) the recovery phrase.
const SERVICE = 'app.zecky.lockit.pin';
const ROUNDS = 10_000;
export const PIN_LENGTH = 4;

const STATE_SERVICE = 'app.zecky.lockit.pinstate';
const FREE_ATTEMPTS = 5;

function hashPin(pin: string, saltHex: string): string {
  return bytesToHex(
    pbkdf2(sha256, utf8ToBytes(pin), hexToBytes(saltHex), {
      c: ROUNDS,
      dkLen: 32,
    }),
  );
}

// --- Whether a code is set, as a tiny store the screens can subscribe to ---

let enabled = false;
const listeners = new Set<() => void>();
function setEnabled(next: boolean) {
  enabled = next;
  listeners.forEach(listener => listener());
}

/** Call once at startup. Resolves to whether a code is set. */
export async function loadPinState(): Promise<boolean> {
  const entry = await Keychain.getGenericPassword({ service: SERVICE });
  await loadFailures();
  setEnabled(entry !== false);
  return enabled;
}

export function usePinEnabled(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

// --- Setting, checking and removing the code ---

export async function setPin(pin: string): Promise<void> {
  const salt = bytesToHex(secureEntropy(16));
  const result = await Keychain.setGenericPassword(salt, hashPin(pin, salt), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (result === false) throw new Error('Could not save the code');
  clearFailures();
  setEnabled(true);
}

export async function clearPin(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
  clearFailures();
  setEnabled(false);
}

/** How long the keypad stays blocked after `failures` wrong codes in a row. */
export function lockoutSeconds(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(30 * 2 ** (failures - FREE_ATTEMPTS), 15 * 60);
}

// --- Wrong-code counting ---
//
// The count and the remaining wait live in the Keychain, so deleting and
// reinstalling the app does not reset them. The wait is counted down only
// while Zecky is open and in front; it does not read the phone's clock,
// so changing the date or time cannot skip it.

let fails = 0;
let remaining = 0;
let ticker: ReturnType<typeof setInterval> | null = null;

function persistState(): void {
  Keychain.setGenericPassword('state', JSON.stringify({ fails, remaining }), {
    service: STATE_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }).catch(() => {});
}

function stopTicker(): void {
  if (ticker != null) clearInterval(ticker);
  ticker = null;
}

function startTicker(): void {
  if (ticker != null || remaining <= 0) return;
  ticker = setInterval(() => {
    if (AppState.currentState !== 'active') return;
    remaining = Math.max(0, remaining - 1);
    if (remaining === 0) stopTicker();
    if (remaining % 5 === 0) persistState();
  }, 1000);
}

async function loadFailures(): Promise<void> {
  try {
    const entry = await Keychain.getGenericPassword({
      service: STATE_SERVICE,
    });
    if (entry === false) return;
    const saved = JSON.parse(entry.password) as {
      fails?: unknown;
      remaining?: unknown;
    };
    fails = typeof saved.fails === 'number' ? saved.fails : 0;
    remaining = typeof saved.remaining === 'number' ? saved.remaining : 0;
    startTicker();
  } catch {
    // Unreadable state: start from zero.
  }
}

function clearFailures(): void {
  fails = 0;
  remaining = 0;
  stopTicker();
  persistState();
}

/** Seconds until another attempt is allowed, or 0 when free to try. */
export function secondsUntilRetry(): number {
  return remaining;
}

/**
 * Checks a code. Wrong codes are counted across app restarts; after a few
 * misses each further miss blocks the keypad for a growing time.
 */
export async function verifyPin(pin: string): Promise<boolean> {
  if (secondsUntilRetry() > 0) return false;
  const entry = await Keychain.getGenericPassword({ service: SERVICE });
  if (entry === false) return true;
  if (hashPin(pin, entry.username) === entry.password) {
    clearFailures();
    return true;
  }
  fails += 1;
  remaining = lockoutSeconds(fails);
  persistState();
  startTicker();
  return false;
}
