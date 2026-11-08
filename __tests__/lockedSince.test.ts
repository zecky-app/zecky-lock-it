import type { Transaction } from 'react-native-zcash';
import {
  daysSince,
  heldFor,
  historyComplete,
  lockedSince,
} from '../src/lib/lockedSince';
import { addOwnAddresses, clearOwnAddresses } from '../src/lib/transactions';

const DAY = 86_400;
const T0 = Date.UTC(2026, 0, 10, 12) / 1000;
const FEE = '10000';

// The engine's shape: `value` is the size of the balance change without a
// sign (a send already includes its fee), `isSent` gives the direction.
const base = (id: string, day: number, extra: Partial<Transaction>) =>
  ({
    rawTransactionId: id,
    blockTimeInSeconds: T0 + day * DAY,
    minedHeight: day,
    isShielding: false,
    isExpired: false,
    memos: [],
    ...extra,
  } as Transaction);
const receive = (id: string, day: number, value: string) =>
  base(id, day, { value, isSent: false });
const send = (id: string, day: number, valueWithFee: string) =>
  base(id, day, {
    value: valueWithFee,
    fee: FEE,
    isSent: true,
    toAddress: 'u1someone',
  });
const ironwoodMove = (id: string, day: number) =>
  base(id, day, { value: FEE, fee: FEE, isSent: true });
const lockIn = (id: string, day: number) =>
  base(id, day, { value: FEE, fee: FEE, isSent: true, isShielding: true });
const at = (day: number) => (T0 + day * DAY) * 1000;

beforeEach(() => clearOwnAddresses());

describe('lockedSince: the count and when it restarts', () => {
  it('is null with nothing in', () => {
    expect(lockedSince([])).toBeNull();
  });

  it('starts at the first payment in', () => {
    expect(
      lockedSince([receive('b', 5, '100'), receive('a', 1, '100')])?.getTime(),
    ).toBe(at(1));
  });

  it('a small send does not reset it', () => {
    const list = [receive('a', 1, '100000000'), send('b', 3, '1010000')];
    expect(lockedSince(list)?.getTime()).toBe(at(1));
  });

  it('a big send that leaves something does not reset it', () => {
    // 1 ZEC in, 0.9999 ZEC out (fee included): 0.0001 ZEC stays.
    const list = [receive('a', 1, '100000000'), send('b', 3, '99990000')];
    expect(lockedSince(list)?.getTime()).toBe(at(1));
  });

  it('the fee is counted once: a send that leaves exactly the fee is not zero', () => {
    // Before, the fee was taken twice and this wallet looked empty.
    const list = [receive('a', 1, '100000'), send('b', 2, '90000')];
    expect(lockedSince(list)?.getTime()).toBe(at(1));
  });

  it('a payment in between does not reset it', () => {
    const list = [
      receive('a', 1, '100000'),
      send('b', 2, '50000'),
      receive('c', 4, '70000'),
    ];
    expect(lockedSince(list)?.getTime()).toBe(at(1));
  });

  it('restarts only after the balance was zero, at the next payment in', () => {
    const list = [
      receive('a', 1, '100000'),
      send('b', 2, '100000'),
      receive('c', 6, '50000'),
    ];
    expect(lockedSince(list)?.getTime()).toBe(at(6));
  });

  it('is null when everything left', () => {
    expect(
      lockedSince([receive('a', 1, '100000'), send('b', 2, '100000')]),
    ).toBeNull();
  });

  it('internal moves count as nothing: locking in and the Ironwood move', () => {
    const list = [
      receive('a', 1, '100000'),
      lockIn('b', 2),
      ironwoodMove('c', 3),
    ];
    expect(lockedSince(list)?.getTime()).toBe(at(1));
  });

  it('an internal move never starts the count', () => {
    // A history that begins with a move (an older birthday cut off the receive).
    const list = [ironwoodMove('a', 1), receive('b', 3, '50000')];
    expect(lockedSince(list)?.getTime()).toBe(at(3));
  });

  it('a payment to an own address is internal', () => {
    addOwnAddresses(['u1mine']);
    const list = [
      receive('a', 1, '100000'),
      base('b', 2, { value: FEE, fee: FEE, isSent: true, toAddress: 'u1mine' }),
    ];
    expect(lockedSince(list)?.getTime()).toBe(at(1));
  });

  it('after a restore the same history gives the same start, in any order', () => {
    const list = [
      receive('a', 1, '100000'),
      send('b', 2, '100000'),
      receive('c', 6, '50000'),
      send('d', 9, '20000'),
    ];
    const restored = [...list].reverse();
    expect(lockedSince(restored)?.getTime()).toBe(lockedSince(list)?.getTime());
    expect(lockedSince(restored)?.getTime()).toBe(at(6));
  });

  it('ignores waiting and expired payments', () => {
    const list = [
      receive('a', 0, '100000'),
      base('b', 3, { value: '100000', isSent: false, isExpired: true }),
    ];
    expect(lockedSince(list)).toBeNull();
  });

  it('older entries without isSent still read a named recipient as sent', () => {
    const list = [
      base('a', 1, { value: '100000' }),
      base('b', 2, { value: '100000', fee: FEE, toAddress: 'u1someone' }),
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

describe('heldFor: the largest whole unit, singular and plural', () => {
  it.each([
    [0, 'since today'],
    [1, 'for 1 day'],
    [2, 'for 2 days'],
    [6, 'for 6 days'],
    [7, 'for 1 week'],
    [13, 'for 1 week'],
    [14, 'for 2 weeks'],
    [29, 'for 4 weeks'],
    [30, 'for 1 month'],
    [59, 'for 1 month'],
    [60, 'for 2 months'],
    [364, 'for 11 months'],
    [365, 'for 1 year'],
    [729, 'for 1 year'],
    [730, 'for 2 years'],
  ])('%i days: %s', (days, text) => {
    expect(heldFor(days)).toBe(text);
  });
});

describe('historyComplete: no count from a history that misses the start', () => {
  it('a full history adds up to the balance', () => {
    const list = [receive('a', 1, '300000'), send('b', 2, '50000')];
    expect(historyComplete(list, '250000')).toBe(true);
  });

  it('a restore from a later date misses older payments in', () => {
    // Held 1 ZEC since long ago; the history only shows a later 0.1 ZEC in.
    const list = [receive('b', 30, '10000000')];
    expect(historyComplete(list, '110000000')).toBe(false);
  });

  it('a payment still waiting to come in is not a missing start', () => {
    const list = [receive('a', 1, '300000'), receive('p', 0, '200000')];
    expect(historyComplete(list, '500000')).toBe(true);
  });
});
