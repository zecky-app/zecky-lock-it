import * as Keychain from 'react-native-keychain';
import { entropyToMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { secureEntropy } from './entropy';

const SERVICE = 'app.zecky.lockit.seed';

export interface StoredWallet {
  mnemonic: string;
  birthdayHeight: number;
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

/**
 * The phrase lives only in the iOS Keychain / Android Keystore: readable
 * while the phone is unlocked, never synced to iCloud or another device.
 */
export async function saveWallet(wallet: StoredWallet): Promise<void> {
  const result = await Keychain.setGenericPassword(
    String(wallet.birthdayHeight),
    wallet.mnemonic,
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
  if (result === false) throw new Error('Could not save the recovery phrase');
}

export async function loadWallet(): Promise<StoredWallet | null> {
  const entry = await Keychain.getGenericPassword({ service: SERVICE });
  if (entry === false) return null;
  return { mnemonic: entry.password, birthdayHeight: Number(entry.username) };
}

export async function deleteWallet(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
