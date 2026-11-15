import { blockBeat } from '../src/lib/blockSweep';

const ok = { synced: true, foreground: true, reduceMotion: false };
const both = { label: true, light: true };
const none = { label: false, light: false };

test('a new block at the tip, on screen: the number and the light', () => {
  expect(blockBeat(3_551_000, 3_551_001, ok)).toEqual(both);
});

test('nothing for the first height after start, or a height that did not go up', () => {
  expect(blockBeat(0, 3_551_000, ok)).toEqual(none);
  expect(blockBeat(3_551_000, 3_551_000, ok)).toEqual(none);
  expect(blockBeat(3_551_000, 3_550_990, ok)).toEqual(none);
});

test('nothing while catching up or in the background', () => {
  expect(blockBeat(1, 2, { ...ok, synced: false })).toEqual(none);
  expect(blockBeat(1, 2, { ...ok, foreground: false })).toEqual(none);
});

test('with Reduce Motion only the number shows', () => {
  expect(blockBeat(1, 2, { ...ok, reduceMotion: true })).toEqual({
    label: true,
    light: false,
  });
});
