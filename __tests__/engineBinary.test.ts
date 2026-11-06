// Self-audit D1: the Zcash engine (libzcashlc, which derives keys, proves and
// signs) is the Zecky engine release v4.0.0-zecky.2 of zecky-app/zecky-engine:
// the official zcash-swift-wallet-sdk 4.0.0 FFI on the NU7 releases of
// librustzcash, built from commit 3a69cb0. scripts/fetch-engine.sh puts it
// into react-native-zcash after checking these same checksums. See
// docs/ENGINE.md.
//
// When this test fails after an update, do not just change the numbers:
// rebuild the engine from its tagged commit and compare first.
export {};

const fs = jest.requireActual<{
  readFileSync: {
    (path: string): Uint8Array;
    (path: string, encoding: 'utf8'): string;
  };
  existsSync: (path: string) => boolean;
}>('fs');
const { createHash } = jest.requireActual<{
  createHash: (algorithm: string) => {
    update: (data: Uint8Array) => { digest: (encoding: string) => string };
  };
}>('crypto');

const ROOT = 'node_modules/react-native-zcash/ios/libzcashlc.xcframework';
const HEADER = 'node_modules/react-native-zcash/ios/zcashlc.h';
const HEADER_SHA256 =
  '1d9cada2baa1c0f3c7f8035422e1feecd9f0bd696ce7b07ea686313d2844a2dc';
const EXPECTED: Record<string, string> = {
  'ios-arm64/libzcashlc.a':
    '94c9b1feb7c35fb1a13c779fc8b78e236910145005ead405f81ae7c414a0b2cd',
  'ios-arm64_x86_64-simulator/libzcashlc.a':
    '91d6a1d685b0b97ad9b036af7e758c685c52b8e9cdac08fef00867bfb0ebc1d1',
};

test.each(Object.entries(EXPECTED))(
  'engine binary %s is the verified upstream build',
  (file, sha256) => {
    const path = `${ROOT}/${file}`;
    expect(fs.existsSync(path)).toBe(true);
    const actual = createHash('sha256')
      .update(fs.readFileSync(path))
      .digest('hex');
    expect(actual).toBe(sha256);
  },
);

test('engine header zcashlc.h matches the engine release', () => {
  const actual = createHash('sha256')
    .update(fs.readFileSync(HEADER))
    .digest('hex');
  expect(actual).toBe(HEADER_SHA256);
});

test('the install step pins the same engine', () => {
  const script = fs.readFileSync('scripts/fetch-engine.sh', 'utf8');
  expect(script).toContain('releases/download/v4.0.0-zecky.2');
  expect(script).toContain(HEADER_SHA256);
  expect(script).toContain(EXPECTED['ios-arm64/libzcashlc.a']);
});

test('Settings › About names the same engine release', () => {
  const about = fs.readFileSync('src/lib/about.ts', 'utf8');
  const script = fs.readFileSync('scripts/fetch-engine.sh', 'utf8');
  const release = /ENGINE_RELEASE = '([^']+)'/.exec(about)?.[1];
  expect(release).toBeDefined();
  expect(script).toContain(`releases/download/${release}`);
});
