// The "Locked for" page: highlights from the history, the milestone path
// and its names, and the once-a-day milestone moment.
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
  holding,
  markMomentSeen,
  milestoneLine,
  milestoneName,
  milestonePath,
  momentSeen,
  resetMoment,
  shortPath,
  stackingPace,
} from '../src/lib/holding';

const DAY = 86_400;
const T0 = Date.UTC(2026, 0, 10, 12) / 1000;
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
const send = (id: string, day: number, value: string) =>
  base(id, day, { value, fee: '10000', isSent: true, toAddress: 'u1someone' });
const lockIn = (id: string, day: number) =>
  base(id, day, {
    value: '10000',
    fee: '10000',
    isSent: true,
    isShielding: true,
  });
const day = (n: number) => new Date((T0 + n * DAY) * 1000);

describe('holding', () => {
  it('is null for an empty lock', () => {
    expect(holding([])).toBeNull();
    expect(holding([receive('a', 1, '100'), send('b', 2, '100')])).toBeNull();
  });

  it('counts payments in, received and the largest since the start', () => {
    const h = holding(
      [
        receive('a', 1, '300000'),
        send('b', 2, '50000'),
        receive('c', 3, '900000'),
        lockIn('d', 4),
        receive('e', 5, '200000'),
      ],
      day(12),
    );
    expect(h?.since.getTime()).toBe(day(1).getTime());
    expect(h?.days).toBe(11);
    expect(h?.current.paymentsIn).toBe(3);
    expect(h?.current.received).toBe(1_400_000n);
    expect(h?.current.largest?.zatoshi).toBe(900_000n);
    expect(h?.current.largest?.at.getTime()).toBe(day(3).getTime());
  });

  it('only what came in after the last empty lock counts', () => {
    const h = holding(
      [
        receive('a', 1, '5000000'),
        send('b', 2, '5000000'),
        receive('c', 4, '100000'),
      ],
      day(6),
    );
    expect(h?.current.received).toBe(100_000n);
    expect(h?.current.paymentsIn).toBe(1);
  });

  it('shows the longest earlier stretch only when it was longer than now', () => {
    const list = [
      receive('a', 1, '100000'),
      send('b', 41, '100000'), // 40 days
      receive('c', 50, '100000'),
    ];
    expect(holding(list, day(60))?.longestBefore?.days).toBe(40);
    expect(holding(list, day(95))?.longestBefore).toBeNull();
  });
});

describe('milestones on the page', () => {
  it('every milestone has its own name, rising to Legend', () => {
    const days = [
      7, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365, 730, 1095,
      1460,
    ];
    const names = days.map(milestoneName);
    expect(new Set(names).size).toBe(days.length);
    expect(names[0]).toBe('Locked');
    expect(milestoneName(365)).toBe('Guardian');
    expect(milestoneName(1460)).toBe('Legend');
    expect(milestoneName(1825)).toBe('Legend · 5 years');
    expect(milestoneLine(30)).toBe('1 month in the lock.');
    expect(milestoneLine(90)).toBe('3 months in the lock.');
    expect(milestoneLine(1460)).toBe('4 years in the lock.');
  });

  it('the whole path runs to Legend at 4 years', () => {
    const path = milestonePath(new Date(2026, 0, 10), 10);
    expect(path.map(s => s.days)).toEqual([
      7, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365, 730, 1095,
      1460,
    ]);
    expect(path[0].reached).toBe(true);
    expect(path[0].at.getDate()).toBe(17);
    expect(path[1].inDays).toBe(20);
    expect(path[1].progress).toBeCloseTo(3 / 23);
    expect(path[2].progress).toBeUndefined();
  });

  it('past Legend it keeps the next three years', () => {
    const path = milestonePath(new Date(2020, 0, 1), 1500);
    expect(path.slice(-4).map(s => s.days)).toEqual([1460, 1825, 2190, 2555]);
  });

  it('the short view: the last one reached and the next two', () => {
    const since = new Date(2026, 0, 10);
    expect(shortPath(milestonePath(since, 3)).map(s => s.days)).toEqual([
      7, 30, 60,
    ]);
    expect(shortPath(milestonePath(since, 45)).map(s => s.days)).toEqual([
      30, 60, 90,
    ]);
    expect(shortPath(milestonePath(since, 400)).map(s => s.days)).toEqual([
      365, 730, 1095,
    ]);
  });
});

describe('the milestone moment', () => {
  it('is shown once per milestone of a holding, and reset by Erase wallet', () => {
    const since = day(1);
    expect(momentSeen(since, 30)).toBe(false);
    markMomentSeen(since, 30);
    expect(momentSeen(since, 30)).toBe(true);
    expect(momentSeen(since, 365)).toBe(false);
    expect(momentSeen(day(2), 30)).toBe(false);
    resetMoment();
    expect(momentSeen(since, 30)).toBe(false);
  });
});

describe('stacking pace', () => {
  it('none on the first day or with nothing received', () => {
    expect(stackingPace(1_000_000n, 0)).toBeNull();
    expect(stackingPace(0n, 10)).toBeNull();
  });

  it('per day in the first week, per week to 3 months, then per month', () => {
    expect(stackingPace(3_000_000n, 3)).toEqual({
      zatoshi: 1_000_000n,
      per: 'day',
    });
    expect(stackingPace(14_000_000n, 14)).toEqual({
      zatoshi: 7_000_000n,
      per: 'week',
    });
    expect(stackingPace(120_000_000n, 120)).toEqual({
      zatoshi: 30_000_000n,
      per: 'month',
    });
  });

  it('is rounded to 3 significant digits', () => {
    // 1,234,567 zats over 10 days is 864,196.9 a week: 864,000.
    expect(stackingPace(1_234_567n, 10)?.zatoshi).toBe(864_000n);
  });
});
