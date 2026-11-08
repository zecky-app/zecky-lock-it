const mockSettings: Record<string, unknown> = {};
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: (key: string) => mockSettings[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mockSettings, values),
  },
}));
const mockKeychain: Record<string, { password: string; options: unknown }> = {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  getGenericPassword: async (o: { service: string }) =>
    mockKeychain[o.service]
      ? { username: 'sent', password: mockKeychain[o.service].password }
      : false,
  setGenericPassword: async (
    _u: string,
    password: string,
    options: { service: string },
  ) => {
    mockKeychain[options.service] = { password, options };
    return true;
  },
  resetGenericPassword: async (o: { service: string }) => {
    delete mockKeychain[o.service];
    return true;
  },
}));

import type { Transaction } from 'react-native-zcash';
import {
  clearSent,
  loadSentLog,
  pruneSent,
  recordSent,
  sentEntry,
  detailFrom,
  txIdsFrom,
} from '../src/lib/sentLog';
import { friendlyError } from '../src/lib/errors';

const tx = (id: string, minedHeight: number, isExpired = false) =>
  ({ rawTransactionId: id, minedHeight, isExpired } as Transaction);

test('reads the txids from an undelivered-payment failure', () => {
  expect(txIdsFrom('txids:ab12,cd34 code 18: bad')).toEqual(['ab12', 'cd34']);
  expect(txIdsFrom('Failed to spend')).toEqual([]);
});

test('remembers undelivered payments until confirmed or expired', () => {
  clearSent();
  recordSent(['aa', 'bb'], true);
  recordSent(['cc'], false);
  expect(sentEntry('aa')?.waiting).toBe(true);
  expect(sentEntry('cc')?.waiting).toBe(false);
  pruneSent([tx('aa', 100), tx('bb', 0, true), tx('cc', 0)]);
  expect(sentEntry('aa')).toBeNull();
  expect(sentEntry('bb')).toBeNull();
  expect(sentEntry('cc')).not.toBeNull();
});

test('no message ever says nothing left the wallet after a send attempt', () => {
  expect(friendlyError('transaction not attempted')).not.toMatch(
    /nothing left your wallet/i,
  );
  expect(friendlyError('Failed to spend')).toMatch(/Check Activity/);
});

test('the engine reason is kept for Release saved (N6)', () => {
  expect(detailFrom('txids:ab12 detail:Tor connection failed')).toBe(
    'Tor connection failed',
  );
  expect(detailFrom('txids:ab12,cd34 code 18: bad-txns')).toBe(
    'code 18: bad-txns',
  );
  expect(detailFrom('txids:ab12')).toBeNull();
  expect(detailFrom('Failed to spend')).toBeNull();
});

test('the log lives in the Keychain, and an old settings copy is moved out (C-29)', async () => {
  clearSent();
  mockSettings['zecky.sent'] = JSON.stringify({
    old1: { at: 5, waiting: true },
  });
  await loadSentLog();
  expect(sentEntry('old1')?.waiting).toBe(true);
  expect(mockSettings['zecky.sent']).toBeNull();
  const stored = mockKeychain['app.zecky.lockit.sent'];
  expect(JSON.parse(stored.password).old1.at).toBe(5);
  expect((stored.options as { accessible: string }).accessible).toBe(
    'WhenUnlockedThisDeviceOnly',
  );
  recordSent(['new1'], false);
  await new Promise<void>(r => setTimeout(r, 0));
  expect(
    JSON.parse(mockKeychain['app.zecky.lockit.sent'].password).new1,
  ).toBeTruthy();
});
