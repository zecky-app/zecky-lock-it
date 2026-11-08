import { getServer, sameServer, SERVER_PRESETS } from './server';
import { useSyncExternalStore } from 'react';
import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { osRandomBytes } from '../wallet/nativeRandom';
import {
  KeyRemoval,
  PHRASE_KEY_MIN_KEYS,
  removalDue,
  removalStartHeight,
} from './keyRules';
import {
  Assertion,
  PairedKey,
  Registration,
  readAssertion,
  readRegistration,
  toBase64,
} from './webauthn';

// Security keys (FIDO2, such as a YubiKey) as an extra key to release.
// Pairing and checking go through Apple's own security key sheet. Nothing is
// sent anywhere: the key is tapped against the phone, and the answer is
// checked on the phone against the public key saved when pairing.

const SERVICE = 'app.zecky.lockit.seckeys';

/** Whether Zecky is on one of its built-in public servers (audit C-28). */
export function onPublicServer(): boolean {
  const current = getServer();
  return SERVER_PRESETS.some(p => sameServer(p.server, current));
}
/**
 * The highest synced height, in its own item (audit C-06): it changes on
 * every synced block, and rewriting the key list that often would risk
 * losing it (the Keychain library deletes before it adds). The item also
 * marks that keys were set up: if it exists but the key list is gone, Zecky
 * fails closed instead of sending without a key.
 */
const HEIGHT_SERVICE = 'app.zecky.lockit.seckeysheight';

export type KeyRole = 'main' | 'backup';

export interface SecurityKey extends PairedKey {
  role: KeyRole;
  /** ISO date the key was added. */
  added: string;
}

export type SecurityKeyFailure =
  | 'unsupported' // this iPhone or copy of Zecky cannot use security keys
  | 'cancelled' // the person closed the sheet
  | 'duplicate' // this key is already added
  | 'none' // no key is paired
  | 'wrong' // the answer did not check out
  | 'failed'; // anything else

export class SecurityKeyError extends Error {
  constructor(readonly reason: SecurityKeyFailure, message: string) {
    super(message);
  }
}

interface NativeKeys {
  securityKeySupported(): Promise<boolean>;
  securityKeyRegister(challenge: string, userId: string): Promise<Registration>;
  securityKeyAssert(challenge: string, ids: string[]): Promise<Assertion>;
  securityKeyVerify(
    publicKey: string,
    authenticatorData: string,
    clientDataJSON: string,
    signature: string,
  ): Promise<boolean>;
}

function native(): NativeKeys | null {
  const module = NativeModules.RNZcash;
  return typeof module?.securityKeyRegister === 'function' ? module : null;
}

function nativeFailure(e: unknown): SecurityKeyError {
  const code = (e as { code?: string })?.code;
  if (code === 'SECURITY_KEY_CANCELLED') {
    return new SecurityKeyError('cancelled', 'No key was tapped.');
  }
  if (code === 'SECURITY_KEY_UNSUPPORTED') {
    return new SecurityKeyError(
      'unsupported',
      'This iPhone cannot use security keys.',
    );
  }
  return new SecurityKeyError(
    'failed',
    'The key could not be read. Hold it still against the top of your iPhone and try again.',
  );
}

export async function securityKeysSupported(): Promise<boolean> {
  try {
    return (await native()?.securityKeySupported()) === true;
  } catch {
    return false;
  }
}

// --- The saved state ---

export interface KeysState {
  keys: SecurityKey[];
  /** Showing the recovery phrase also asks a key. */
  phraseNeedsKey: boolean;
  /** "Lost my keys", while its 48 hours run. */
  removal: KeyRemoval | null;
  /** Highest block height seen while fully synced (re-check R1). */
  heightSeen: number;
}

const EMPTY: KeysState = {
  keys: [],
  phraseNeedsKey: false,
  removal: null,
  heightSeen: 0,
};

export class KeysUnreadableError extends Error {}
let state: KeysState = EMPTY;
const listeners = new Set<() => void>();

function publish(next: KeysState) {
  state = next;
  listeners.forEach(listener => listener());
}

/**
 * Reads the saved state. Anything unreadable throws instead of counting as
 * "no keys" (re-check R2): a damaged entry must never switch the keys off.
 */
function parse(text: string): KeysState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new KeysUnreadableError(UNREADABLE);
  }
  // Step 2 saved a plain list of keys.
  if (Array.isArray(raw)) return { ...EMPTY, keys: raw };
  const r = raw as Partial<KeysState> | null;
  if (r == null || !Array.isArray(r.keys)) {
    throw new KeysUnreadableError(UNREADABLE);
  }
  return {
    keys: r.keys,
    phraseNeedsKey: r.phraseNeedsKey === true,
    removal:
      r.removal && typeof r.removal.startedAt === 'string' ? r.removal : null,
    heightSeen: typeof r.heightSeen === 'number' ? r.heightSeen : 0,
  };
}

const UNREADABLE =
  'Zecky could not read your security keys. Nothing was shown or sent. Close Zecky and open it again; if it stays like this, restore from your 24 words.';
const MISSING =
  'Your security keys were set up on this iPhone but their record is gone. Nothing was sent. Close Zecky and open it again; if it stays like this, restore from your 24 words.';

function parseHeight(text: string): number {
  try {
    const raw = JSON.parse(text) as { heightSeen?: unknown };
    return typeof raw?.heightSeen === 'number' ? raw.heightSeen : 0;
  } catch {
    return 0;
  }
}

/** Call once at startup. */
export async function loadSecurityKeyState(): Promise<KeysState> {
  const [entry, marker] = await Promise.all([
    Keychain.getGenericPassword({ service: SERVICE }),
    Keychain.getGenericPassword({ service: HEIGHT_SERVICE }),
  ]);
  if (!entry) {
    // Keys were set up (the marker is there) but the list is gone: never
    // treat that as "no keys" (audit C-06).
    if (marker) throw new KeysUnreadableError(MISSING);
    publish(EMPTY);
    return state;
  }
  const parsed = parse(entry.password);
  const heightSeen = Math.max(
    parsed.heightSeen,
    marker ? parseHeight(marker.password) : 0,
  );
  publish({ ...parsed, heightSeen });
  return state;
}

async function saveHeight(heightSeen: number): Promise<void> {
  const result = await Keychain.setGenericPassword(
    'height',
    JSON.stringify({ heightSeen }),
    {
      service: HEIGHT_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (!result) throw new Error('The security key could not be saved.');
}

export function getSecurityKeyState(): KeysState {
  return state;
}

export function useSecurityKeys(): KeysState {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export async function loadSecurityKeys(): Promise<SecurityKey[]> {
  return (await loadSecurityKeyState()).keys;
}

async function save(next: KeysState): Promise<void> {
  if (next.keys.length === 0) {
    await Keychain.resetGenericPassword({ service: SERVICE });
    await Keychain.resetGenericPassword({ service: HEIGHT_SERVICE }).catch(
      () => false,
    );
    publish(EMPTY);
    return;
  }
  // The marker first, so a key list is never found without it.
  if (state.keys.length === 0) await saveHeight(next.heightSeen);
  const result = await Keychain.setGenericPassword(
    'keys',
    JSON.stringify(next),
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (!result) throw new Error('The security key could not be saved.');
  publish(next);
}

export async function clearSecurityKeys(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE }).catch(() => false);
  await Keychain.resetGenericPassword({ service: HEIGHT_SERVICE }).catch(
    () => false,
  );
  publish(EMPTY);
}

// --- Checking a key ---

/**
 * Asks for one of the paired keys and checks its answer. Resolves when a
 * paired key answered correctly, throws SecurityKeyError otherwise.
 */
export async function checkSecurityKey(): Promise<SecurityKey> {
  const keys = (await loadSecurityKeyState()).keys;
  if (keys.length === 0) {
    throw new SecurityKeyError('none', 'No security key is added.');
  }
  const keysModule = native();
  if (!keysModule) {
    throw new SecurityKeyError(
      'unsupported',
      'This copy of Zecky cannot use security keys.',
    );
  }
  const challenge = osRandomBytes(32);
  let answer: Assertion;
  try {
    answer = await keysModule.securityKeyAssert(
      toBase64(challenge),
      keys.map(k => k.id),
    );
  } catch (e) {
    throw nativeFailure(e);
  }
  let found: { key: PairedKey; signCount: number };
  try {
    found = readAssertion(answer, challenge, keys);
  } catch (e) {
    throw new SecurityKeyError('wrong', (e as Error).message);
  }
  let valid = false;
  try {
    valid = await keysModule.securityKeyVerify(
      found.key.publicKey,
      answer.authenticatorData,
      answer.clientDataJSON,
      answer.signature,
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new SecurityKeyError('wrong', 'This key did not answer correctly.');
  }
  const updated = state.keys.map(k =>
    k.id === found.key.id ? { ...k, signCount: found.signCount } : k,
  );
  await save({ ...state, keys: updated });
  return updated.find(k => k.id === found.key.id) as SecurityKey;
}

// --- Adding and removing keys ---

/**
 * Shows Apple's sheet and saves the new key once it checks out. With keys
 * already paired, one of them is asked first: otherwise someone could add
 * their own key and use it to remove yours. (The first key is guarded by
 * the owner check on the screen.)
 */
export async function addSecurityKey(role: KeyRole): Promise<SecurityKey> {
  const keysModule = native();
  if (!keysModule || !(await securityKeysSupported())) {
    throw new SecurityKeyError(
      'unsupported',
      'This iPhone cannot use security keys.',
    );
  }
  const current = await loadSecurityKeyState();
  if (current.removal != null) {
    throw new SecurityKeyError(
      'failed',
      'Cancel the key removal first, or wait until it is done.',
    );
  }
  if (current.keys.length > 0) await checkSecurityKey();
  const challenge = osRandomBytes(32);
  // A random ID, so the key holds no name, email or anything else about you.
  const userId = osRandomBytes(16);
  let answer: Registration;
  try {
    answer = await keysModule.securityKeyRegister(
      toBase64(challenge),
      toBase64(userId),
    );
  } catch (e) {
    throw nativeFailure(e);
  }
  let paired: PairedKey;
  try {
    paired = readRegistration(answer, challenge);
  } catch (e) {
    throw new SecurityKeyError('wrong', (e as Error).message);
  }
  if (state.keys.some(k => k.id === paired.id)) {
    throw new SecurityKeyError('duplicate', 'This key is already added.');
  }
  const key: SecurityKey = { ...paired, role, added: new Date().toISOString() };
  await save({ ...state, keys: [...state.keys, key] });
  return key;
}

/** Removes one key, after a tap of any paired key. */
export async function removeSecurityKey(id: string): Promise<void> {
  await checkSecurityKey();
  const keys = state.keys.filter(k => k.id !== id);
  await save({
    ...state,
    keys,
    phraseNeedsKey: state.phraseNeedsKey && keys.length > 0,
  });
}

// --- The recovery phrase ---

export async function setPhraseNeedsKey(on: boolean): Promise<void> {
  if (on) {
    if (state.keys.length < PHRASE_KEY_MIN_KEYS) {
      throw new SecurityKeyError('failed', 'Add a backup key first.');
    }
    await save({ ...state, phraseNeedsKey: true });
    return;
  }
  await checkSecurityKey();
  await save({ ...state, phraseNeedsKey: false });
}

// --- "Lost my keys" ---

/**
 * Remembers the highest block height seen while fully synced, so a server
 * that reports a lower one cannot shorten a removal (re-check R1).
 */
export async function noteSyncedHeight(height: number): Promise<void> {
  if (state.keys.length === 0 || !(height > state.heightSeen)) return;
  // Only the small height item is rewritten, never the key list (C-06).
  await saveHeight(height);
  publish({ ...state, heightSeen: height });
}

/**
 * Starts the 48-hour removal, from a height Zecky reached while fully
 * synced. The screen asks the owner first.
 */
export async function startKeyRemoval(syncedHeight: number): Promise<void> {
  const current = await loadSecurityKeyState();
  const start = removalStartHeight(syncedHeight, current.heightSeen);
  if (start == null) {
    throw new SecurityKeyError(
      'failed',
      syncedHeight <= 0
        ? 'Wait until Zecky is up to date, then try again.'
        : 'This server is behind what Zecky has seen before. Switch back to your usual server, then try again.',
    );
  }
  await save({
    ...current,
    removal: { startedAt: new Date().toISOString(), startHeight: start },
  });
}

/**
 * Changing the server while a removal runs starts the 48 hours again, so
 * switching between servers cannot be used to shorten it (re-check R1).
 */
export async function restartKeyRemovalIfRunning(): Promise<void> {
  const current = await loadSecurityKeyState();
  if (current.removal == null) return;
  await save({
    ...current,
    removal: {
      startedAt: new Date().toISOString(),
      startHeight: Math.max(current.removal.startHeight, current.heightSeen),
    },
  });
}

/** Stops the removal, after a tap of any paired key. */
export async function cancelKeyRemoval(): Promise<void> {
  await checkSecurityKey();
  await save({ ...state, removal: null });
}

/**
 * Finishes the removal once both the network and the clock show 48 hours.
 * Returns true when the keys were removed.
 */
export async function finishKeyRemovalIfDue(
  syncedHeight: number,
): Promise<boolean> {
  if (!removalDue(state.removal, Date.now(), syncedHeight)) return false;
  // Audit C-28: the block height comes from the server. A server of one's
  // own could report blocks that do not exist and, with the clock moved
  // forward, end the 48 hours at once. The removal therefore only finishes
  // on one of the built-in public servers, reached over TLS.
  if (!onPublicServer()) return false;
  await clearSecurityKeys();
  return true;
}
