import {
  clearSyncProblems,
  recordSyncProblem,
  syncProblems,
  unscannedSegments,
} from '../src/lib/syncProblems';

beforeEach(() => clearSyncProblems());

test('keeps the last five problems, newest first, without repeats', () => {
  recordSyncProblem('A', 0);
  recordSyncProblem('A', 30_000); // same within a minute
  for (let i = 1; i <= 6; i++) recordSyncProblem(`P${i}`, 100_000 * i);
  const list = syncProblems();
  expect(list.map(p => p.message)).toEqual(['P6', 'P5', 'P4', 'P3', 'P2']);
});

test('the scan map clips ranges to the birthday and the tip', () => {
  const gaps = unscannedSegments(
    {
      fullyScanned: 100,
      maxScanned: 200,
      toScan: [
        [50, 150, 20],
        [180, 250, 50],
      ],
    },
    100,
    200,
  );
  expect(gaps).toEqual([
    { from: 0, to: 0.5 },
    { from: 0.8, to: 1 },
  ]);
  expect(
    unscannedSegments(
      { fullyScanned: null, maxScanned: null, toScan: [] },
      10,
      10,
    ),
  ).toEqual([]);
});

describe('ring since the birthday', () => {
  const { checkedShare, ringPercent } = require('../src/lib/syncProblems');

  test('a night of new blocks starts high, not at zero', () => {
    // 100,000 blocks since the birthday, the newest 400 still to check.
    const share = checkedShare(
      { fullyScanned: 199_600, maxScanned: 199_600, toScan: [[199_600, 200_000, 10]] },
      100_000,
      200_000,
    );
    expect(share).toBeCloseTo(0.996);
    expect(ringPercent(share, false)).toBe(99.6);
  });

  test('ranges are clipped and overlaps count once', () => {
    const share = checkedShare(
      { fullyScanned: null, maxScanned: null, toScan: [[50, 150, 1], [120, 160, 1], [190, 400, 1]] },
      100,
      200,
    );
    // Open: 100..160 and 190..200 = 70 of 100.
    expect(share).toBeCloseTo(0.3);
  });

  test('never 100 before the wallet is up to date, always 100 when it is', () => {
    expect(ringPercent(0.99999, false)).toBe(99.9);
    expect(ringPercent(1, false)).toBe(99.9);
    expect(ringPercent(0.5, true)).toBe(100);
  });

  test('no network block yet gives no number', () => {
    expect(checkedShare({ fullyScanned: null, maxScanned: null, toScan: [] }, 100, 0)).toBeNull();
  });
});
