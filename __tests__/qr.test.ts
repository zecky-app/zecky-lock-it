import { makeQrMatrix } from '../src/lib/qr';

test('builds a square matrix with finder patterns', () => {
  const { size, rows } = makeQrMatrix('u1' + 'q'.repeat(200));
  expect(rows).toHaveLength(size);
  // Top-left and top-right finder patterns are 7 dark modules wide.
  expect(rows[0][0]).toEqual({ start: 0, length: 7 });
  expect(rows[0][rows[0].length - 1]).toEqual({ start: size - 7, length: 7 });
  for (const runs of rows) {
    for (const run of runs) {
      expect(run.start + run.length).toBeLessThanOrEqual(size);
    }
  }
});

test('high error correction makes a denser code', () => {
  const text = 'u1' + 'q'.repeat(200);
  expect(makeQrMatrix(text, 'H').size).toBeGreaterThan(makeQrMatrix(text).size);
});
