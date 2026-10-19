import type { Transaction } from 'react-native-zcash';
import {
  addOwnAddresses,
  clearOwnAddresses,
  isPending,
  mergeTransactions,
  txKind,
} from '../src/lib/transactions';

const tx = (id: string, minedHeight: number, extra = {}): Transaction => ({
  rawTransactionId: id,
  blockTimeInSeconds: minedHeight * 75,
  minedHeight,
  value: '1000',
  isShielding: false,
  isExpired: false,
  memos: [],
  ...extra,
});

test('merges batches, updates changed ones, newest and pending first', () => {
  let list = mergeTransactions([], [tx('a', 100), tx('b', 0)]);
  expect(list.map(t => t.rawTransactionId)).toEqual(['b', 'a']);
  list = mergeTransactions(list, [tx('b', 90), tx('c', 120)]);
  expect(list.map(t => t.rawTransactionId)).toEqual(['c', 'a', 'b']);
  expect(list).toHaveLength(3);
});

test('classifies transactions', () => {
  expect(txKind(tx('a', 1))).toBe('received');
  expect(txKind(tx('a', 1, { toAddress: 'u1abc' }))).toBe('sent');
  expect(txKind(tx('a', 1, { isShielding: true, toAddress: 'u1' }))).toBe(
    'shielded',
  );
  expect(isPending(tx('a', 0))).toBe(true);
  expect(isPending(tx('a', 0, { isExpired: true }))).toBe(false);
  expect(isPending(tx('a', 5))).toBe(false);
});

test('a payment to one of our own addresses is "to yourself"', () => {
  addOwnAddresses(['u1own', null, undefined]);
  expect(txKind(tx('a', 1, { toAddress: 'u1own' }))).toBe('self');
  expect(txKind(tx('a', 1, { toAddress: 'u1other' }))).toBe('sent');
  clearOwnAddresses();
  expect(txKind(tx('a', 1, { toAddress: 'u1own' }))).toBe('sent');
});
