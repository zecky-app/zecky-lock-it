import { nextMilestone } from '../src/lib/milestones';

test('day one is on the way to one week', () => {
  expect(nextMilestone(0)).toEqual({ name: '1 week', inDays: 7, progress: 0 });
});

test('progress is measured from the previous milestone', () => {
  const m = nextMilestone(65);
  expect(m?.name).toBe('100 days');
  expect(m?.inDays).toBe(35);
  expect(m?.progress).toBeCloseTo((65 - 30) / (100 - 30));
});

test('reaching a milestone points to the next one', () => {
  expect(nextMilestone(365)?.name).toBe('2 years');
});

test('after five years there is no next milestone', () => {
  expect(nextMilestone(1825)).toBeNull();
  expect(nextMilestone(4000)).toBeNull();
});
