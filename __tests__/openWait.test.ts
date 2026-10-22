import { DEFAULT_OPEN_WAIT, toOpenWait } from '../src/lib/openWait';

test('only the offered waits are accepted', () => {
  expect(toOpenWait(5)).toBe(5);
  expect(toOpenWait(0)).toBe(0);
  expect(toOpenWait(undefined)).toBe(DEFAULT_OPEN_WAIT);
  expect(toOpenWait(7)).toBe(DEFAULT_OPEN_WAIT);
  expect(toOpenWait('3')).toBe(DEFAULT_OPEN_WAIT);
  expect(DEFAULT_OPEN_WAIT).toBe(10);
});
