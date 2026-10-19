/* eslint-disable no-bitwise */
import { TurboModuleRegistry } from 'react-native';
import type { TurboModule } from 'react-native';

interface RandomModule extends TurboModule {
  getRandomBase64(byteLength: number): string;
}

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/[=]+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Invalid random data');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

/**
 * Random bytes straight from the operating system's secure generator
 * (SecRandomCopyBytes on iOS). This deliberately calls the native module
 * itself and not `crypto.getRandomValues`: the JavaScript wrapper around it
 * contains a fallback to ordinary, guessable random numbers for one
 * debugging mode, and key material must never be able to take that path.
 * If the native generator is missing, this throws. There is no fallback.
 */
export function osRandomBytes(length: number): Uint8Array {
  const native =
    TurboModuleRegistry.getEnforcing<RandomModule>('RNGetRandomValues');
  const bytes = decodeBase64(native.getRandomBase64(length));
  if (bytes.length !== length) {
    throw new Error('The secure random generator returned too little data');
  }
  return bytes;
}
