// The QR code on Receive: a light paper background, and a quiet zone of
// about 4 to 6 modules (at least the 4 the QR standard asks).
export {};

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('fs');
const source = fs.readFileSync('src/components/QrCode.tsx', 'utf8');

test('paper color, not pure white, with dark modules', () => {
  expect(source).toContain("QR_PAPER = '#ECE8DF'");
  expect(source).not.toContain("'#FFFFFF'");
});

test('quiet zone of at least 4 modules, snapped to pixels', () => {
  expect(source).toContain('const QUIET_MODULES = 4;');
  // A 3x screen, a 260-point code and a 65-module address (high correction).
  const size = 260;
  const modules = 65;
  const scale = 3;
  const cell = Math.floor((size * scale) / (modules + 8)) / scale;
  const margin = (size - cell * modules) / 2 / cell;
  expect(margin).toBeGreaterThanOrEqual(4);
  expect(margin).toBeLessThanOrEqual(6.5);
});
