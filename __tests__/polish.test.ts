import type { Transaction } from 'react-native-zcash';
import { estimateBirthdayHeight, estimateTipHeight } from '../src/lib/birthday';
import { friendlyError } from '../src/lib/errors';
import { transactionsToCsv } from '../src/lib/export';
import { buildPaymentUri, parseScanned } from '../src/lib/paymentUri';
import { uncountedDust } from '../src/lib/transactions';

const tx = (extra: Partial<Transaction>): Transaction => ({
  rawTransactionId: 'id',
  blockTimeInSeconds: 1_700_000_000,
  minedHeight: 2_300_000,
  value: '100000',
  isShielding: false,
  isExpired: false,
  memos: [],
  ...extra,
});

test('birthday estimate is early, never late, and clamped', () => {
  const now = Date.UTC(2026, 9, 11);
  const tip = estimateTipHeight(now);
  const oneYearAgo = estimateBirthdayHeight(2025, 9, tip, now);
  const exact = tip - Math.round((now - Date.UTC(2025, 9, 1)) / 75000);
  expect(oneYearAgo).toBeLessThan(exact);
  expect(exact - oneYearAgo).toBeLessThan(20_000);
  // The current month starts just below the tip; the future clamps to it.
  expect(estimateBirthdayHeight(2026, 9, tip, now)).toBeLessThan(tip);
  expect(estimateBirthdayHeight(2030, 0, tip, now)).toBeLessThanOrEqual(tip);
  // Before Blossom blocks were slower; before Sapling clamps to its start.
  const mid2019 = estimateBirthdayHeight(2019, 5, tip, now);
  expect(mid2019).toBeGreaterThan(419_200);
  expect(mid2019).toBeLessThan(653_600);
  expect(estimateBirthdayHeight(2017, 0, tip, now)).toBe(419_200);
});

test('errors become plain sentences', () => {
  expect(friendlyError('Failed to spend: InsufficientFunds')).toMatch(
    /Not enough available funds/,
  );
  expect(friendlyError('shieldFunds: Wallet is not synced')).toMatch(
    /still syncing/,
  );
  expect(friendlyError('grpc status unavailable')).toMatch(/Cannot reach/);
  expect(friendlyError('Something odd')).toBe('Something odd');
});

test('history exports as CSV', () => {
  const csv = transactionsToCsv([
    tx({ memos: ['Thanks, "friend"'], toAddress: 'u1abc', fee: '10000' }),
    tx({ rawTransactionId: 'p', minedHeight: 0, blockTimeInSeconds: 0 }),
  ]).split('\n');
  expect(csv).toHaveLength(3);
  expect(csv[1]).toBe(
    '2023-11-14 22:13:20,sent,0.001,0.0001,confirmed,u1abc,"Thanks, ""friend""",2300000,id',
  );
  expect(csv[2]).toBe(',received,0.001,,pending,,,,p');
});

test('payment requests round-trip through the scanner', () => {
  const address = 'u1' + 'q'.repeat(60);
  expect(buildPaymentUri(address)).toBe(`zcash:${address}`);
  const uri = buildPaymentUri(address, '150000000');
  expect(uri).toBe(`zcash:${address}?amount=1.5`);
  expect(parseScanned(uri)).toEqual({ address, zatoshi: '150000000' });
});

test('finds received payments too small to count', () => {
  expect(
    uncountedDust([
      tx({ value: '1000' }),
      tx({ value: '5000' }),
      tx({ value: '5001' }),
      tx({ value: '900', toAddress: 'u1x' }),
    ]),
  ).toEqual({ count: 2, zatoshi: '6000' });
});
