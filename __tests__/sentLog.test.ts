const mockSettings: Record<string, unknown> = {};
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: (key: string) => mockSettings[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mockSettings, values),
  },
}));

import type { Transaction } from 'react-native-zcash';
import {
  clearSent,
  pruneSent,
  recordSent,
  sentEntry,
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
