import { milestoneDays, milestoneState } from '../src/lib/milestones';

test('1 week, every month of the first year, 1 year, then every year', () => {
  expect(milestoneDays(400)).toEqual([
    7, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 365, 730,
  ]);
});

test('day one is on the way to one week', () => {
  expect(milestoneState(0)).toEqual({ progress: 0, reachedToday: false });
  expect(milestoneState(3).progress).toBeCloseTo(3 / 7);
});

test('progress is measured from the previous milestone', () => {
  expect(milestoneState(10).progress).toBeCloseTo((10 - 7) / (30 - 7));
  expect(milestoneState(45).progress).toBeCloseTo((45 - 30) / 30);
  expect(milestoneState(350).progress).toBeCloseTo((350 - 330) / (365 - 330));
  expect(milestoneState(400).progress).toBeCloseTo((400 - 365) / 365);
});

test('on the milestone day only, the ring is full and glows', () => {
  for (const day of [7, 30, 60, 330, 365, 730, 1460, 3650]) {
    expect(milestoneState(day)).toEqual({ progress: 1, reachedToday: true });
    expect(milestoneState(day + 1).reachedToday).toBe(false);
    expect(milestoneState(day - 1).reachedToday).toBe(false);
  }
});

test('after the first year, once a year, with no end', () => {
  expect(milestoneState(390).reachedToday).toBe(false);
  expect(milestoneState(365 * 14).reachedToday).toBe(true);
});
