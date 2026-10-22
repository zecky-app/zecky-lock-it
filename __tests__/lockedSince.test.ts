import type { Transaction } from 'react-native-zcash';
import { daysSince, lockedSince } from '../src/lib/lockedSince';

const DAY = 86_400;
const T0 = Date.UTC(2026, 0, 10, 12) / 1000;

function tx(
  id: string,
  height: number,
  value: string,
  toAddress?: string,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    rawTransactionId: id,
    blockTimeInSeconds: T0 + height * DAY,
    minedHeight: height,
    value,
    fee: toAddress ? '10000' : undefined,
    toAddress,
    ...extra,
  } as Transaction;
}

describe('lockedSince', () => {
  it('is null with nothing in', () => {
    expect(lockedSince([])).toBeNull();
  });

  it('starts at the first payment in', () => {
    const list = [tx('b', 5, '100'), tx('a', 1, '100')];
    expect(lockedSince(list)?.getTime()).toBe((T0 + DAY) * 1000);
  });

  it('starts again after the wallet was emptied', () => {
    const list = [
      tx('a', 1, '100000'),
      tx('b', 2, '90000', 'zs1someone'),
      tx('c', 4, '50000'),
    ];
    expect(lockedSince(list)?.getTime()).toBe((T0 + 4 * DAY) * 1000);
  });

  it('is null when everything left', () => {
    const list = [tx('a', 1, '100000'), tx('b', 2, '90000', 'zs1someone')];
    expect(lockedSince(list)).toBeNull();
  });

  it('ignores waiting and expired payments', () => {
    const list = [
      tx('a', 0, '100000'),
      tx('b', 3, '100000', undefined, {
        isExpired: true,
      } as Partial<Transaction>),
    ];
    expect(lockedSince(list)).toBeNull();
  });
});

describe('daysSince', () => {
  it('counts calendar days', () => {
    const since = new Date(2026, 0, 10, 23, 30);
    expect(daysSince(since, new Date(2026, 0, 10, 23, 59))).toBe(0);
    expect(daysSince(since, new Date(2026, 0, 11, 0, 5))).toBe(1);
    expect(daysSince(since, new Date(2026, 1, 9, 8))).toBe(30);
  });
});
