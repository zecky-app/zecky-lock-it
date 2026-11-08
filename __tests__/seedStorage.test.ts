// Audit C-01, C-02, C-03, C-07, C-08: how the phrase item is written, read
// and replaced. A fake Keychain that behaves like react-native-keychain 10:
// setGenericPassword deletes the service's item before adding the new one,
// a guarded read can be cancelled (rejects), hasGenericPassword never
// prompts.
type Item = { username: string; password: string; guarded: boolean };
let mockStore: Record<string, Item> = {};
let mockPasscode = true;
let mockCancelGuardedRead = false;
let mockFailAddFor: string | null = null;
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WhenPasscodeSetThisDeviceOnly',
  },
  ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'Biometry' },
  isPasscodeAuthAvailable: async () => mockPasscode,
  hasGenericPassword: async (o: { service: string }) => o.service in mockStore,
  setGenericPassword: async (
    username: string,
    password: string,
    o: { service: string; accessControl?: string },
  ) => {
    delete mockStore[o.service];
    if (mockFailAddFor === o.service) throw new Error('errSecParam');
    mockStore[o.service] = {
      username,
      password,
      guarded: o.accessControl != null,
    };
    return { service: o.service };
  },
  getGenericPassword: async (o: {
    service: string;
    authenticationPrompt?: unknown;
  }) => {
    const item = mockStore[o.service];
    if (item == null) return false;
    if (item.guarded && mockCancelGuardedRead) {
      throw new Error('User canceled the operation.');
    }
    return { username: item.username, password: item.password };
  },
  resetGenericPassword: async (o: { service: string }) => {
    const had = o.service in mockStore;
    delete mockStore[o.service];
    return had;
  },
}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: () => new Uint8Array(0),
}));

import {
  guardIfPossible,
  migrateOldWallet,
  readSeed,
  saveWallet,
  seedPresent,
  SeedMissingError,
  WalletExistsError,
} from '../src/wallet/seed';

const SEED = 'app.zecky.lockit.seedguarded';
const WALLET = 'app.zecky.lockit.wallet';
const OLD = 'app.zecky.lockit.seed';
const words = 'twelve words of test phrase';

beforeEach(() => {
  mockStore = {};
  mockPasscode = true;
  mockCancelGuardedRead = false;
  mockFailAddFor = null;
});

test('creating or restoring refuses while a wallet is on the phone (C-02)', async () => {
  await saveWallet({ mnemonic: words, birthdayHeight: 1 }, 'uview1a');
  await expect(
    saveWallet({ mnemonic: 'other words', birthdayHeight: 2 }, 'uview1b'),
  ).rejects.toBeInstanceOf(WalletExistsError);
  expect(mockStore[SEED].password).toBe(words);
  // The old unguarded item alone also counts as a wallet.
  mockStore = { [OLD]: { username: '1', password: words, guarded: false } };
  await expect(
    saveWallet({ mnemonic: 'other words', birthdayHeight: 2 }, 'uview1b'),
  ).rejects.toBeInstanceOf(WalletExistsError);
});

test('a phrase without a wallet item is not left behind', async () => {
  mockFailAddFor = WALLET;
  await expect(
    saveWallet({ mnemonic: words, birthdayHeight: 1 }, 'uview1a'),
  ).rejects.toThrow();
  expect(mockStore[SEED]).toBeUndefined();
});

test('readSeed never falls back to the old item while the guarded one exists (C-07)', async () => {
  await saveWallet({ mnemonic: words, birthdayHeight: 1 }, 'uview1a');
  mockStore[OLD] = { username: '1', password: 'stale words', guarded: false };
  mockCancelGuardedRead = true;
  await expect(readSeed('test')).rejects.toThrow(/cancel/i);
  mockCancelGuardedRead = false;
  expect(await readSeed('test')).toBe(words);
});

test('a missing phrase is reported as missing, not as cancelled (C-01)', async () => {
  await saveWallet({ mnemonic: words, birthdayHeight: 1 }, 'uview1a');
  // iOS removed the guarded item when the passcode was turned off.
  delete mockStore[SEED];
  expect(await seedPresent()).toBe(false);
  await expect(readSeed('test')).rejects.toBeInstanceOf(SeedMissingError);
});

test('guarding keeps a copy until the guarded item is read back (C-03)', async () => {
  mockPasscode = false;
  const keys = await saveWallet({ mnemonic: words, birthdayHeight: 7 }, 'u');
  expect(keys.guarded).toBe(false);
  mockPasscode = true;
  // The guarded add fails: the phrase must still be on the phone.
  mockFailAddFor = SEED;
  await expect(guardIfPossible(keys)).rejects.toThrow();
  expect(mockStore[OLD].password).toBe(words);
  expect(await readSeed('test')).toBe(words);
  // Next start: the interrupted move is finished from the copy.
  mockFailAddFor = null;
  const moved = await migrateOldWallet(async () => 'u', keys);
  expect(moved?.guarded).toBe(true);
  expect(mockStore[SEED].guarded).toBe(true);
  expect(mockStore[OLD]).toBeUndefined();
  expect(JSON.parse(mockStore[WALLET].username).guarded).toBe(true);
});

test('a cancelled read-back leaves both items in place', async () => {
  mockStore[OLD] = { username: '9', password: words, guarded: false };
  mockCancelGuardedRead = true;
  await expect(migrateOldWallet(async () => 'u')).rejects.toThrow();
  expect(mockStore[OLD].password).toBe(words);
});

test('without a passcode the move is read back too, without a prompt (C-08)', async () => {
  mockPasscode = false;
  mockStore[OLD] = { username: '9', password: words, guarded: false };
  const keys = await migrateOldWallet(async () => 'u');
  expect(keys?.guarded).toBe(false);
  expect(mockStore[SEED].password).toBe(words);
  expect(mockStore[OLD]).toBeUndefined();
});
