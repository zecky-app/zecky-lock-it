import {
  nodeKind,
  nodeVerified,
  parseSavedServers,
  saveServer,
} from '../src/lib/server';

// Self-audit N2 and re-check R3/R4: which own node this is, and whether
// Zecky can tell it is really yours.
test('home-network and Tailscale numbers are own nodes, but not provably yours', () => {
  expect(nodeKind({ host: '100.101.102.103', port: 8137 })).toBe('tailscaleIp');
  expect(nodeKind({ host: '192.168.1.20', port: 8137 })).toBe('home');
  expect(nodeKind({ host: '10.0.0.5', port: 8137 })).toBe('home');
  expect(nodeKind({ host: '172.16.0.1', port: 8137 })).toBe('home');
  expect(nodeKind({ host: '100.12.0.1', port: 443 })).toBeNull();
  expect(nodeKind({ host: 'zec.rocks', port: 443 })).toBeNull();
  expect(nodeVerified('home')).toBe(false);
  expect(nodeVerified('tailscaleIp')).toBe(false);
});

test('a typed …ts.net name is not your node; one saved from Rock it’s code is', () => {
  const funnel = { host: 'someone.tail9999.ts.net', port: 443 };
  expect(nodeKind(funnel)).toBeNull();
  saveServer('Community server', funnel);
  expect(nodeKind(funnel)).toBeNull();
  const mine = { host: 'rockit.tail1234.ts.net', port: 443 };
  saveServer('Rock it', mine, true);
  expect(nodeKind(mine)).toBe('tailscale');
  expect(nodeVerified('tailscale')).toBe(true);
  // Renaming keeps it as your node.
  saveServer('Rock it at home', mine);
  expect(nodeKind(mine)).toBe('tailscale');
});

test('servers saved before the "own" mark: only …ts.net names stay your node', () => {
  const list = parseSavedServers(
    JSON.stringify([
      { name: 'Rock it', address: 'rockit.tail1234.ts.net:443' },
      { name: 'Other', address: 'example.com:443' },
      { name: 'Marked', address: 'x.tail1.ts.net:443', own: false },
    ]),
  );
  expect(list.map(s => s.own)).toEqual([true, false, false]);
});
