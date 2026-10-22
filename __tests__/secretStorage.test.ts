// How secrets are stored: always on this device only, never synced.
const mockCalls: { service?: string; options: Record<string, unknown> }[] = [];
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WhenPasscodeSetThisDeviceOnly',
  },
  ACCESS_CONTROL: { USER_PRESENCE: 'UserPresence' },
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

test('the recovery phrase is saved for this device only, while unlocked', async () => {
  await saveWallet({ mnemonic: 'test words', birthdayHeight: 1 });
  const call = mockCalls.find(c => c.service === 'app.zecky.lockit.seed');
  expect(call?.options.accessible).toBe('WhenUnlockedThisDeviceOnly');
  expect(call?.options).not.toHaveProperty('synchronizable');
  expect(call?.options).not.toHaveProperty('cloudSync');
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
