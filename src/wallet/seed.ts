import * as Keychain from 'react-native-keychain';
import { entropyToMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { secureEntropy } from './entropy';

// Two Keychain items (self-audit K1, after the DarkSword iOS exploit):
//
// - The recovery phrase, guarded by the Secure Enclave: iOS only releases it
//   after Face ID or the iPhone passcode, at the moment Zecky sends, locks
//   in or shows the phrase. A dump of the Keychain files cannot read it.
//   Without an iPhone passcode the Secure Enclave cannot guard it; then it
//   is stored as before (this device only, while unlocked) and Security
//   says so.
// - The viewing key and the wallet birthday, read at every start to sync.
//   It shows the history but can never move Zcash.
//
// The phrase is not kept in memory after the first start: it is read, used
// once and dropped.
//
// Audit C-01: iOS deletes a guarded item when the iPhone passcode is turned
// off. Zecky checks at every start that the item is still there (without a
// prompt) and says so plainly when it is not; see seedPresent.
//
// Audit C-03: the Keychain library writes an item by deleting the old one
// and adding the new one. The phrase is therefore never rewritten in place:
// a second copy is kept (the old, unguarded item) until the guarded copy
// has been read back. See promoteOldSeed.

const SEED = 'app.zecky.lockit.seedguarded';
const WALLET = 'app.zecky.lockit.wallet';
/**
 * The phrase before build 20: no access control. Also the safety copy while
 * the guarded item is written. Removed once the guarded copy is read back.
 */
const OLD_SEED = 'app.zecky.lockit.seed';

export const WALLET_SERVICES = [SEED, WALLET, OLD_SEED];

export interface StoredWallet {
  mnemonic: string;
  birthdayHeight: number;
}

/** What the wallet screen gets: everything except the phrase. */
export interface WalletKeys {
  /** Unified full viewing key: enough to sync, never to spend. */
  ufvk: string;
  birthdayHeight: number;
  /** Whether the Secure Enclave guards the phrase (false: no passcode). */
  guarded: boolean;
  /**
   * True when the guarded phrase item is gone from this iPhone (iOS removes
   * it when the passcode is turned off). Syncing still works; sending,
   * locking in and showing the phrase cannot.
   */
  seedMissing?: boolean;
}

/** Thrown by readSeed when there is no phrase item on this iPhone at all. */
export class SeedMissingError extends Error {
  code = 'SEED_MISSING' as const;
  constructor() {
    super('The recovery phrase is no longer on this iPhone.');
  }
}

/** Thrown by saveWallet when a wallet is already on this iPhone. */
export class WalletExistsError extends Error {
  code = 'WALLET_EXISTS' as const;
  constructor() {
    super(
      'A wallet is already on this iPhone. Zecky does not replace it: open it, or erase it under Settings › Security first.',
    );
  }
}

/**
 * A fresh 24-word recovery phrase, from 256 bits of checked entropy.
 * The library's own generator is deliberately not used here: see
 * ./entropy.ts for where the randomness comes from and why.
 */
export function createMnemonic(): string {
  return entropyToMnemonic(secureEntropy(32), wordlist);
}

/** Lowercases and collapses whitespace so pasted phrases compare cleanly. */
export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ');
}

export function isValidMnemonic(phrase: string): boolean {
  return validateMnemonic(normalizeMnemonic(phrase), wordlist);
}

async function passcodeSet(): Promise<boolean> {
  try {
    return await Keychain.isPasscodeAuthAvailable();
  } catch {
    return false;
  }
}

/** Whether an item exists, without any prompt (also for guarded items). */
async function exists(service: string): Promise<boolean> {
  return (await Keychain.hasGenericPassword({ service })) === true;
}

/** Writes the phrase, guarded when the iPhone has a passcode. */
async function writeSeed(mnemonic: string): Promise<boolean> {
  const guarded = await passcodeSet();
  const result = await Keychain.setGenericPassword('seed', mnemonic, {
    service: SEED,
    ...(guarded
      ? {
          accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
          accessControl:
            Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        }
      : { accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  });
  if (result === false) throw new Error('Could not save the recovery phrase');
  return guarded;
}

async function writeKeys(keys: Omit<WalletKeys, 'seedMissing'>): Promise<void> {
  const result = await Keychain.setGenericPassword(
    JSON.stringify({ birthday: keys.birthdayHeight, guarded: keys.guarded }),
    keys.ufvk,
    {
      service: WALLET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (result === false) throw new Error('Could not save the wallet');
}

/**
 * A new or restored wallet: the phrase, guarded, and its viewing key.
 * Refuses when a wallet is already on this iPhone (audit C-02): the only
 * way to replace a wallet is Erase wallet, which removes these items first.
 */
export async function saveWallet(
  wallet: StoredWallet,
  ufvk: string,
): Promise<WalletKeys> {
  if ((await exists(WALLET)) || (await exists(OLD_SEED))) {
    throw new WalletExistsError();
  }
  const guarded = await writeSeed(wallet.mnemonic);
  const keys = { ufvk, birthdayHeight: wallet.birthdayHeight, guarded };
  try {
    await writeKeys(keys);
  } catch (e) {
    // No viewing key, no wallet: do not leave a phrase behind that nothing
    // can open.
    await Keychain.resetGenericPassword({ service: SEED }).catch(() => false);
    throw e;
  }
  return keys;
}

/**
 * Audit C-49: stores the viewing key the engine derived again from the
 * phrase, when a newer engine writes it differently. Without this the
 * phrase would be asked again at every start.
 */
export async function updateViewingKey(
  keys: WalletKeys,
  ufvk: string,
): Promise<void> {
  if (ufvk === keys.ufvk) return;
  await writeKeys({
    ufvk,
    birthdayHeight: keys.birthdayHeight,
    guarded: keys.guarded,
  });
}

/**
 * The viewing key and birthday, without touching the phrase. A damaged item
 * throws (never "no wallet"): the caller shows an error, not Welcome.
 */
export async function loadWalletKeys(): Promise<WalletKeys | null> {
  const entry = await Keychain.getGenericPassword({ service: WALLET });
  if (entry === false) return null;
  let meta: { birthday?: unknown; guarded?: unknown };
  try {
    meta = JSON.parse(entry.username);
  } catch {
    throw new Error('The wallet item on this iPhone could not be read.');
  }
  const birthdayHeight = Number(meta?.birthday);
  if (!entry.password || !Number.isFinite(birthdayHeight)) {
    throw new Error('The wallet item on this iPhone could not be read.');
  }
  return {
    ufvk: entry.password,
    birthdayHeight,
    guarded: meta.guarded === true,
  };
}

/**
 * Whether a phrase item is on this iPhone: the guarded one or the old one.
 * No prompt. False after the iPhone passcode was turned off (iOS removes
 * guarded items then), or after anything else removed it.
 */
export async function seedPresent(): Promise<boolean> {
  return (await exists(SEED)) || (await exists(OLD_SEED));
}

/**
 * The viewing key from the old, unguarded item, for a session in which the
 * move was cancelled. It is tried again at the next start.
 */
export async function legacyWalletKeys(
  deriveUfvk: (mnemonic: string) => Promise<string>,
): Promise<WalletKeys | null> {
  const old = await Keychain.getGenericPassword({ service: OLD_SEED });
  if (old === false) return null;
  return {
    ufvk: await deriveUfvk(old.password),
    birthdayHeight: Number(old.username),
    guarded: false,
  };
}

/** An install from before build 20, or an interrupted move, still has the unguarded item. */
export async function hasOldWallet(): Promise<boolean> {
  return exists(OLD_SEED);
}

/**
 * Moves the phrase from the old, unguarded item into the guarded one. The
 * old item is removed only after the new one has been read back: with Face
 * ID or the passcode when guarded, without a prompt otherwise (audit C-08).
 * Any failure leaves both items as they are and throws.
 */
async function promoteOldSeed(
  mnemonic: string,
  keys: Omit<WalletKeys, 'guarded' | 'seedMissing'>,
): Promise<WalletKeys> {
  const guarded = await writeSeed(mnemonic);
  const check = await readGuarded(
    'Move your recovery phrase into the Secure Enclave',
  );
  if (check !== mnemonic) {
    throw new Error(
      'The recovery phrase could not be moved. Nothing was changed.',
    );
  }
  const next = { ...keys, guarded };
  await writeKeys(next);
  await Keychain.resetGenericPassword({ service: OLD_SEED });
  return next;
}

/**
 * One-time move for installs from before build 20: the phrase into the
 * Secure Enclave, the viewing key next to it. `deriveUfvk` comes from the
 * Zcash engine; `ufvk` can be given when it is already known.
 */
export async function migrateOldWallet(
  deriveUfvk: (mnemonic: string) => Promise<string>,
  known?: Omit<WalletKeys, 'guarded' | 'seedMissing'>,
): Promise<WalletKeys | null> {
  const old = await Keychain.getGenericPassword({ service: OLD_SEED });
  if (old === false) return null;
  const mnemonic = old.password;
  const keys = known ?? {
    ufvk: await deriveUfvk(mnemonic),
    birthdayHeight: Number(old.username),
  };
  return promoteOldSeed(mnemonic, keys);
}

/**
 * Re-guards the phrase once the iPhone has a passcode (it was stored
 * unguarded because there was none). The unguarded phrase is first copied
 * into the old item, so the rewrite of the guarded item can fail without
 * losing anything; the copy goes when the guarded item has been read back.
 */
export async function guardIfPossible(keys: WalletKeys): Promise<WalletKeys> {
  if (keys.guarded || !(await passcodeSet())) return keys;
  const entry = await Keychain.getGenericPassword({ service: SEED });
  if (entry === false) return keys;
  const copy = await Keychain.setGenericPassword(
    String(keys.birthdayHeight),
    entry.password,
    {
      service: OLD_SEED,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (copy === false) return keys;
  return promoteOldSeed(entry.password, {
    ufvk: keys.ufvk,
    birthdayHeight: keys.birthdayHeight,
  });
}

/** The guarded item, with the prompt. Throws when cancelled; false if absent. */
async function readGuarded(reason: string): Promise<string | false> {
  const entry = await Keychain.getGenericPassword({
    service: SEED,
    authenticationPrompt: { title: reason, cancel: 'Cancel' },
  });
  return entry === false ? false : entry.password;
}

/**
 * The phrase, for one use: iOS asks Face ID or the passcode first when it
 * is guarded. Throws when the person cancels, and SeedMissingError when
 * there is no phrase on this iPhone at all.
 */
export async function readSeed(reason: string): Promise<string> {
  if (await exists(SEED)) {
    const words = await readGuarded(reason);
    if (words !== false) return words;
  }
  // Not moved yet (the move was cancelled or interrupted): the old item.
  // Only consulted while the guarded item is absent (audit C-07).
  const old = await Keychain.getGenericPassword({ service: OLD_SEED });
  if (old !== false) return old.password;
  throw new SeedMissingError();
}

export async function deleteWallet(): Promise<void> {
  for (const service of WALLET_SERVICES) {
    await Keychain.resetGenericPassword({ service });
  }
}

// --- The phrase for the first start, right after creating or restoring ---
//
// The engine needs the phrase once to set up the account. It is held here,
// out of React state and out of the wallet screen's props, and handed over
// exactly once (audit C-04). Every later start uses the viewing key.

let firstStartSeed: string | null = null;

export function stashFirstStartSeed(mnemonic: string): void {
  firstStartSeed = mnemonic;
}

/** Whether a first start with the phrase is pending (create or restore). */
export function hasFirstStartSeed(): boolean {
  return firstStartSeed != null;
}

/** The stashed phrase, once; null afterwards. */
export function takeFirstStartSeed(): string | null {
  const seed = firstStartSeed;
  firstStartSeed = null;
  return seed;
}

export function dropFirstStartSeed(): void {
  firstStartSeed = null;
}
