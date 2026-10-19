// The first start after an install clears what an earlier install left in
// the Keychain, but an update must never lose the wallet.

declare const __dirname: string;

const mockKeychain: Record<string, string> = {};
const mockSettings: Record<string, unknown> = {};
let mockWalletFiles: boolean | 'missing' | 'error' = false;

jest.mock('react-native-keychain', () => ({
  resetGenericPassword: async (options: { service: string }) => {
    const had = options.service in mockKeychain;
    delete mockKeychain[options.service];
    return had;
  },
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: (key: string) => mockSettings[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mockSettings, values),
  },
  NativeModules: {
    get RNZcash() {
      if (mockWalletFiles === 'missing') return {};
      return {
        walletFilesExist: async () => {
          if (mockWalletFiles === 'error') throw new Error('native');
          return mockWalletFiles;
        },
      };
    },
  },
}));
jest.mock('../src/config', () => ({
  NETWORK: 'mainnet',
  WALLET_ALIAS: 'test',
}));

import {
  clearIfFreshInstall,
  KEYCHAIN_SERVICES,
} from '../src/lib/freshInstall';

function fill() {
  for (const service of KEYCHAIN_SERVICES) mockKeychain[service] = 'x';
}
function reset() {
  for (const k of Object.keys(mockKeychain)) delete mockKeychain[k];
  for (const k of Object.keys(mockSettings)) delete mockSettings[k];
}

beforeEach(reset);

test('reinstall: no flag and no wallet files clears every item', async () => {
  fill();
  mockWalletFiles = false;
  expect(await clearIfFreshInstall()).toBe(true);
  expect(Object.keys(mockKeychain)).toEqual([]);
  expect(mockSettings['zecky.installed']).toBe(true);
});

test('update from an older version: wallet files present keeps everything', async () => {
  fill();
  mockWalletFiles = true;
  expect(await clearIfFreshInstall()).toBe(false);
  expect(Object.keys(mockKeychain).length).toBe(KEYCHAIN_SERVICES.length);
  expect(mockSettings['zecky.installed']).toBe(true);
});

test('later starts: the flag is set, nothing is touched', async () => {
  fill();
  mockSettings['zecky.installed'] = true;
  mockWalletFiles = false;
  expect(await clearIfFreshInstall()).toBe(false);
  expect(Object.keys(mockKeychain).length).toBe(KEYCHAIN_SERVICES.length);
});

test('when in doubt it keeps: native check missing or failing', async () => {
  for (const state of ['missing', 'error'] as const) {
    reset();
    fill();
    mockWalletFiles = state;
    expect(await clearIfFreshInstall()).toBe(false);
    expect(Object.keys(mockKeychain).length).toBe(KEYCHAIN_SERVICES.length);
  }
});

test('any Zecky setting means an update, whatever the files say', async () => {
  fill();
  mockSettings['zecky.phraseUnconfirmed'] = false;
  mockWalletFiles = false;
  expect(await clearIfFreshInstall()).toBe(false);
  expect(Object.keys(mockKeychain).length).toBe(KEYCHAIN_SERVICES.length);
});

test('only a clear false from the engine clears', async () => {
  fill();
  mockWalletFiles = undefined as unknown as boolean;
  expect(await clearIfFreshInstall()).toBe(false);
  expect(Object.keys(mockKeychain).length).toBe(KEYCHAIN_SERVICES.length);
});

test('the list covers every Keychain service in the code', () => {
  const fs = require('fs');
  const path = require('path');
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) {
        const text: string = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/'(app\.zecky\.lockit\.[a-z]+)'/g)) {
          found.add(m[1]);
        }
      }
    }
  };
  walk(path.join(__dirname, '..', 'src'));
  expect([...found].sort()).toEqual([...KEYCHAIN_SERVICES].sort());
});
