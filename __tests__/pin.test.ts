jest.mock('react-native-keychain', () => {
  const stored: Record<string, { username: string; password: string }> = {};
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
    setGenericPassword: async (
      username: string,
      password: string,
      options: { service: string },
    ) => {
      stored[options.service] = { username, password };
      return true;
    },
    getGenericPassword: async (options: { service: string }) =>
      stored[options.service] ?? false,
    resetGenericPassword: async (options: { service: string }) => {
      delete stored[options.service];
      return true;
    },
  };
});
/* eslint-disable no-bitwise */
jest.mock('react-native', () => ({ AppState: { currentState: 'active' } }));
jest.mock('../src/wallet/entropy', () => ({
  secureEntropy: (length: number) =>
    Uint8Array.from({ length }, (_, i) => (i * 29 + 7) & 0xff),
}));

import {
  clearPin,
  loadPinState,
  lockoutSeconds,
  secondsUntilRetry,
  setPin,
  verifyPin,
} from '../src/lib/pin';

test('lockout grows after five misses and is capped', () => {
  expect(lockoutSeconds(4)).toBe(0);
  expect(lockoutSeconds(5)).toBe(30);
  expect(lockoutSeconds(6)).toBe(60);
  expect(lockoutSeconds(30)).toBe(900);
});

test('set, verify, lock out, clear', async () => {
  expect(await loadPinState()).toBe(false);
  await setPin('4821');
  expect(await loadPinState()).toBe(true);
  expect(await verifyPin('4821')).toBe(true);
  for (let i = 0; i < 5; i++) expect(await verifyPin('0000')).toBe(false);
  expect(secondsUntilRetry()).toBeGreaterThan(0);
  // Even the right code is refused while the keypad is blocked.
  expect(await verifyPin('4821')).toBe(false);
  await clearPin();
  expect(await loadPinState()).toBe(false);
  expect(secondsUntilRetry()).toBe(0);
});
