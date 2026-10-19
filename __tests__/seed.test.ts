/* eslint-disable no-bitwise */
jest.mock('react-native-keychain', () => ({}));

// Stands in for the phone's secure generator. Each test decides what it
// returns, so we can check what Zecky does when it misbehaves.
let mockNextBytes: (length: number) => Uint8Array;
let counter = 0;
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: (length: number) => mockNextBytes(length),
}));

import { secureEntropy } from '../src/wallet/entropy';
import {
  createMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
} from '../src/wallet/seed';

const healthy = (length: number) => {
  // Deterministic but well spread, and different on every call.
  counter += 1;
  return Uint8Array.from(
    { length },
    (_, i) => (i * 37 + counter * 101 + ((i * i) % 7) * 13) & 0xff,
  );
};

beforeEach(() => {
  mockNextBytes = healthy;
});

test('new phrases are 24 valid words, and differ each time', () => {
  const a = createMnemonic();
  const b = createMnemonic();
  expect(a.split(' ')).toHaveLength(24);
  expect(isValidMnemonic(a)).toBe(true);
  expect(isValidMnemonic(b)).toBe(true);
  expect(a).not.toBe(b);
});

test('a broken generator stops wallet creation', () => {
  mockNextBytes = length => new Uint8Array(length); // all zeros
  expect(() => createMnemonic()).toThrow(/no wallet was created/);
  mockNextBytes = length => new Uint8Array(length).fill(0x41); // stuck value
  expect(() => createMnemonic()).toThrow(/no wallet was created/);
  const fixed = healthy(32);
  mockNextBytes = () => fixed; // returns the same data every time
  expect(() => createMnemonic()).toThrow(/no wallet was created/);
});

test('a missing generator is an error, never a silent fallback', () => {
  mockNextBytes = () => {
    throw new Error('RNGetRandomValues could not be found');
  };
  expect(() => createMnemonic()).toThrow(/could not be found/);
});

test('ordinary random numbers cannot determine the phrase', () => {
  // Pin Math.random and the clocks to constants: the result must still
  // change, because it is driven by the secure generator.
  const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  try {
    const a = secureEntropy(32);
    const b = secureEntropy(32);
    expect(Array.from(a).join()).not.toBe(Array.from(b).join());
  } finally {
    random.mockRestore();
    now.mockRestore();
  }
});

test('key material never comes from the unsafe paths', () => {
  // Jest runs from the project root, so these paths are relative to it.
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const read = (file: string) => fs.readFileSync(file, 'utf8');
  // The phrase must be built from our checked entropy, not the library's
  // own generator, and the polyfill with its weak fallback stays out.
  expect(read('src/wallet/seed.ts')).not.toMatch(/generateMnemonic/);
  expect(read('src/wallet/seed.ts')).toMatch(/secureEntropy\(32\)/);
  expect(read('index.js')).not.toMatch(
    /^import 'react-native-get-random-values'/m,
  );
  expect(read('src/wallet/nativeRandom.ts')).not.toMatch(/Math\.random/);
  expect(read('src/lib/pin.ts')).not.toMatch(/randomBytes/);
});

test('accepts messy pasted input, rejects bad phrases', () => {
  const known =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  expect(
    isValidMnemonic(`  ${known.toUpperCase().replace(/ /g, '  \n')} `),
  ).toBe(true);
  expect(normalizeMnemonic(' Abandon\n  ABOUT ')).toBe('abandon about');
  expect(isValidMnemonic(known.replace('about', 'abandon'))).toBe(false);
  expect(isValidMnemonic('')).toBe(false);
});
