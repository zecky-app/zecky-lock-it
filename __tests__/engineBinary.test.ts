// Self-audit D1: the Zcash engine (libzcashlc, which derives keys, proves and
// signs) is the Zecky engine release v4.0.0-zecky.3 of zecky-app/zecky-engine:
// the official zcash-swift-wallet-sdk 4.0.0 FFI on the NU7 releases of
// librustzcash, built from commit 6d8da89. scripts/fetch-engine.sh puts it
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
    '71893f22b2c103c778d6e6e880877137a218d1b3c87a4bce430be8b7910bbed4',
  'ios-arm64_x86_64-simulator/libzcashlc.a':
    '00f6a525f5cbb3ba9af098a062fe8fc3f922dfdce1a3501e1ccc5788417ba5eb',
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
  expect(script).toContain('releases/download/v4.0.0-zecky.3');
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

test('the Sapling parameters ship in the app, pinned, and are never downloaded by it (C-24)', () => {
  const script = fs.readFileSync('scripts/fetch-sapling-params.sh', 'utf8');
  expect(script).toContain(
    '8e48ffd23abb3a5fd9c5589204f32d9c31285a04b78096ba40a79b75677efc13',
  );
  expect(script).toContain(
    '2f0ebbcbb9bb0bcffe95a397e7eba89c29eb4dde6191c339db88570e3f3fb0e4',
  );
  const patch = fs.readFileSync(
    'patches/react-native-zcash+0.13.5.patch',
    'utf8',
  );
  // The SDK renames the param paths with the alias, so they stay in the
  // writable wallet folder; only the source points into the app bundle.
  expect(patch).toMatch(
    /saplingParamsSourceURL: bundledSaplingParams\(\)\.map/,
  );
  expect(patch).not.toMatch(/spendParamsURL: bundledSaplingParams/);
  const project = fs.readFileSync(
    'ios/Zecky.xcodeproj/project.pbxproj',
    'utf8',
  );
  expect(project).toContain('sapling-spend.params in Resources');
  expect(project).toContain('sapling-output.params in Resources');
});
