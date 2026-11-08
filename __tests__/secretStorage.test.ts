// How secrets are stored: always on this device only, never synced.
const mockCalls: { service?: string; options: Record<string, unknown> }[] = [];
let mockPasscode = true;
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WhenPasscodeSetThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    USER_PRESENCE: 'UserPresence',
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'BiometryAnyOrDevicePasscode',
  },
  isPasscodeAuthAvailable: jest.fn(async () => mockPasscode),
  hasGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
  setGenericPassword: jest.fn(
    async (_u: string, _p: string, options: Record<string, unknown>) => {
      mockCalls.push({ service: options.service as string, options });
      return { service: options.service };
    },
  ),
}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: () => new Uint8Array(0),
}));

import { saveWallet } from '../src/wallet/seed';

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string, options: { recursive: boolean }) => string[];
}>('fs');

test('the recovery phrase is guarded by the Secure Enclave (self-audit K1)', async () => {
  mockCalls.length = 0;
  mockPasscode = true;
  const keys = await saveWallet(
    { mnemonic: 'test words', birthdayHeight: 1 },
    'uview1test',
  );
  const seed = mockCalls.find(
    c => c.service === 'app.zecky.lockit.seedguarded',
  );
  expect(seed?.options.accessible).toBe('WhenPasscodeSetThisDeviceOnly');
  expect(seed?.options.accessControl).toBe('BiometryAnyOrDevicePasscode');
  expect(seed?.options).not.toHaveProperty('synchronizable');
  expect(keys.guarded).toBe(true);
  // The item read at every start holds the viewing key, never the phrase.
  const wallet = mockCalls.find(c => c.service === 'app.zecky.lockit.wallet');
  expect(wallet?.options.accessible).toBe('WhenUnlockedThisDeviceOnly');
  expect(wallet?.options).not.toHaveProperty('accessControl');
});

test('without an iPhone passcode it is stored as before, and says so', async () => {
  mockCalls.length = 0;
  mockPasscode = false;
  const keys = await saveWallet(
    { mnemonic: 'test words', birthdayHeight: 1 },
    'uview1test',
  );
  const seed = mockCalls.find(
    c => c.service === 'app.zecky.lockit.seedguarded',
  );
  expect(seed?.options.accessible).toBe('WhenUnlockedThisDeviceOnly');
  expect(keys.guarded).toBe(false);
});

test('the wallet screen never gets the phrase from storage', () => {
  const sync = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');
  // Starting from the viewing key; the phrase only via readSeed (Face ID).
  expect(sync).toContain('mnemonicSeed: wallet.ufvk');
  expect(sync).not.toMatch(/loadWallet\(/);
  const app = fs.readFileSync('App.tsx', 'utf8');
  expect(app).toContain('loadKeys()');
});

test('every Keychain write in the app is this-device-only', () => {
  const files = fs
    .readdirSync('src', { recursive: true })
    .filter(f => /\.(ts|tsx)$/.test(f))
    .map(f => `src/${f}`);
  const writers = files.filter(f =>
    /\bsetGenericPassword|setInternetCredentials/.test(
      fs.readFileSync(f, 'utf8'),
    ),
  );
  expect(writers.length).toBeGreaterThan(0);
  for (const file of writers) {
    const text = fs.readFileSync(file, 'utf8');
    // \b keeps resetGenericPassword (a delete) out of the count.
    const writes = (text.match(/\bsetGenericPassword\(/g) ?? []).length;
    const deviceOnly = (text.match(/_THIS_DEVICE_ONLY/g) ?? []).length;
    // Each write carries its own this-device-only setting.
    expect({ file, ok: deviceOnly >= writes }).toEqual({ file, ok: true });
    expect(text).not.toMatch(/synchronizable|cloudSync/i);
  }
});
