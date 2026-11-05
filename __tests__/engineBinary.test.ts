// Self-audit D1 (27 Oct 2026): the Zcash engine (libzcashlc, which derives
// keys and signs) arrives prebuilt inside react-native-zcash. These are the
// checksums of the binaries checked byte for byte against the Zcash team's
// own release: zcash-swift-wallet-sdk 2.7.0-rc.4, libzcashlc.xcframework.zip
// (sha256 c012c2b682191f027c1874ecde84adeeaef26dbb3e827dd5f29deb0eb8af0ef2,
// as declared in that release's Package.swift). See docs/ENGINE.md.
//
// When this test fails after an update, do not just change the numbers:
// check the new binaries against the matching upstream release first.
export {};

const fs = jest.requireActual<{
  readFileSync: (path: string) => Uint8Array;
  existsSync: (path: string) => boolean;
}>('fs');
const { createHash } = jest.requireActual<{
  createHash: (algorithm: string) => {
    update: (data: Uint8Array) => { digest: (encoding: string) => string };
  };
}>('crypto');

const ROOT = 'node_modules/react-native-zcash/ios/libzcashlc.xcframework';
const EXPECTED: Record<string, string> = {
  'ios-arm64/libzcashlc.a':
    '1bbc8057add6e5bdac863fa380759e582ffcb4a505ba292ddfd97aede929e5ed',
  'ios-arm64_x86_64-simulator/libzcashlc.a':
    '3ac75d4704fc7bd9564c757e3b92f755c52307e2413993878df7e9bfb7ff9c1c',
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
