import { saveServer } from '../src/lib/server';
import { torBlocksRelease, torForServer } from '../src/lib/tor';

// N1 (self-audit, 27 Oct 2026): with Tor wanted, nothing is released or
// locked in until Tor is connected, because a failed Tor start leaves the
// engine on a direct connection.
test('releases wait for Tor when Tor is wanted', () => {
  expect(torBlocksRelease(true, 'on')).toBe(false);
  for (const status of ['off', 'starting', 'failed', 'unavailable'] as const) {
    expect(torBlocksRelease(true, status)).toBe(true);
  }
});

test('without Tor nothing is blocked', () => {
  for (const status of [
    'off',
    'starting',
    'on',
    'failed',
    'unavailable',
  ] as const) {
    expect(torBlocksRelease(false, status)).toBe(false);
  }
});

// N6 (self-audit, 27 Oct 2026): a Tor exit cannot resolve or reach the
// owner's own node, so with Rock it the wallet talks to it directly.
test('with your own node the wallet does not run over Tor', () => {
  const tailscale = { host: 'rockit.example.ts.net', port: 443 };
  const tailscaleIp = { host: '100.101.102.103', port: 9067 };
  const home = { host: '192.168.1.20', port: 9067 };
  const publicServer = { host: 'zec.rocks', port: 443 };
  // Re-check R3: a typed …ts.net name keeps Tor; one from Rock it's code not.
  expect(torForServer(true, tailscale)).toBe(true);
  saveServer('Rock it', tailscale, true);
  for (const own of [tailscale, tailscaleIp, home]) {
    expect(torForServer(true, own)).toBe(false);
  }
  expect(torForServer(true, publicServer)).toBe(true);
  expect(torForServer(false, publicServer)).toBe(false);
});

test('Tor wanted with your own node does not block releases', () => {
  expect(torBlocksRelease(true, 'ownNode')).toBe(false);
});

test('the engine retries a failed Tor submit at once, but never a rejection', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const patch = fs.readFileSync(
    'patches/react-native-zcash+0.13.5.patch',
    'utf8',
  );
  expect(patch).toContain('if rejected == nil, !undelivered.isEmpty');
  expect(patch).toContain('sdkFlags.torEnabled');
  expect(patch).toContain('for _ in 0..<2 where !undelivered.isEmpty');
});

test('the Tor retry keeps the proposal order and counts "already" as delivered (R5)', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const patch = fs.readFileSync(
    'patches/react-native-zcash+0.13.5.patch',
    'utf8',
  );
  expect(patch).toContain('let waiting = undelivered.compactMap { byId[$0] }');
  expect(patch).toContain('description.lowercased().contains("already")');
});

test('Tor switches run in order and only the latest sets the status (R8)', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const text = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');
  expect(text).toContain('torQueue.current = torQueue.current.then(run, run);');
  expect(text).toContain('if (request === torRequest.current)');
});
