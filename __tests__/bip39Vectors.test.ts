jest.mock('react-native-keychain', () => ({}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: () => new Uint8Array(0),
}));

import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { isValidMnemonic, normalizeMnemonic } from '../src/wallet/seed';

// Official BIP39 test vectors (24 words, from the reference implementation).
// If these hold, a phrase made by Zecky restores in any standard Zcash
// wallet, and any standard 24-word phrase restores in Zecky.
const VECTORS: [string, string][] = [
  [
    '0000000000000000000000000000000000000000000000000000000000000000',
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
  ],
  [
    '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title',
  ],
  [
    '8080808080808080808080808080808080808080808080808080808080808080',
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic bless',
  ],
  [
    'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
  ],
];

function hex(text: string): Uint8Array {
  return Uint8Array.from(text.match(/../g) ?? [], b => parseInt(b, 16));
}

test.each(VECTORS)('entropy %s gives the published words', (entropy, words) => {
  // The same call createMnemonic makes, with the same word list.
  expect(entropyToMnemonic(hex(entropy), wordlist)).toBe(words);
  expect(isValidMnemonic(words)).toBe(true);
});

test('a published phrase typed messily is still accepted', () => {
  const words = VECTORS[1][1];
  const messy = `  ${words.toUpperCase().split(' ').join('   \n')} `;
  expect(normalizeMnemonic(messy)).toBe(words);
  expect(isValidMnemonic(messy)).toBe(true);
});

test('one changed word breaks the checksum', () => {
  const words = VECTORS[2][1].split(' ');
  words[23] = 'abandon';
  expect(isValidMnemonic(words.join(' '))).toBe(false);
});
