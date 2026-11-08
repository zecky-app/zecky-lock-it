// Audit C-36: the release path, branch by branch, with fakes instead of
// source-text checks.
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Settings: {},
}));
jest.mock('react-native-keychain', () => ({}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: () => new Uint8Array(0),
}));

import { release, ReleaseDeps } from '../src/wallet/release';
import { SeedMissingError } from '../src/wallet/seed';
import {
  HOME_NODE_SEND,
  LOCK_NOT_OPEN,
  NU7_PAUSED,
  OFFLINE_SEND,
  SEED_MISSING,
  SEED_NOT_RELEASED,
  SERVER_CHANGED_SEND,
  TOR_NOT_READY,
} from '../src/lib/errors';

const PUBLIC = { host: 'zec.rocks', port: 443 };
const HOME = { host: '192.168.1.20', port: 9067 };

function deps(over: Partial<ReleaseDeps> = {}) {
  const calls: string[] = [];
  const sent: { ids: string[]; waiting: boolean }[] = [];
  const d: ReleaseDeps = {
    walletLive: () => true,
    hasGrant: () => true,
    nu7Paused: () => false,
    torBlocks: () => false,
    isOnline: async () => true,
    server: () => PUBLIC,
    canReachHomeNode: async () => true,
    hasSecurityKeys: async () => false,
    checkSecurityKey: async () => {
      calls.push('key');
    },
    readSeed: async () => {
      calls.push('seed');
      return 'words';
    },
    createTransfer: async () => {
      calls.push('transfer');
      return 'txid1';
    },
    recordSent: (ids, waiting) => sent.push({ ids, waiting }),
    nativeMessage: e => String((e as Error)?.message ?? e),
    ...over,
  };
  return { d, calls, sent };
}

test('a normal release reads the phrase, transfers once and records it', async () => {
  const { d, calls, sent } = deps();
  await expect(release('p', d)).resolves.toBe('txid1');
  expect(calls).toEqual(['seed', 'transfer']);
  expect(sent).toEqual([{ ids: ['txid1'], waiting: false }]);
});

test.each([
  ['the lock is closed', { hasGrant: () => false }, LOCK_NOT_OPEN],
  ['NU7 pauses this engine', { nu7Paused: () => true }, NU7_PAUSED],
  ['Tor is wanted but not up', { torBlocks: () => true }, TOR_NOT_READY],
  ['the phone is offline', { isOnline: async () => false }, OFFLINE_SEND],
  [
    'the home node cannot be reached',
    { server: () => HOME, canReachHomeNode: async () => false },
    HOME_NODE_SEND,
  ],
])('nothing is asked or built when %s', async (_what, over, message) => {
  const { d, calls, sent } = deps(over as Partial<ReleaseDeps>);
  await expect(release('p', d)).rejects.toThrow(message);
  expect(calls).toEqual([]);
  expect(sent).toEqual([]);
});

test('with a security key, the key comes before the phrase and the transfer', async () => {
  const { d, calls } = deps({ hasSecurityKeys: async () => true });
  await release('p', d);
  expect(calls).toEqual(['key', 'seed', 'transfer']);
});

test('a failed key tap stops everything', async () => {
  const { d, calls } = deps({
    hasSecurityKeys: async () => true,
    checkSecurityKey: async () => {
      throw new Error('wrong key');
    },
  });
  await expect(release('p', d)).rejects.toThrow('wrong key');
  expect(calls).toEqual([]);
});

test('re-checks after the key tap: lock closed, Tor down, server changed', async () => {
  let open = true;
  const a = deps({
    hasSecurityKeys: async () => true,
    hasGrant: () => open,
    checkSecurityKey: async () => {
      open = false;
    },
  });
  await expect(release('p', a.d)).rejects.toThrow(LOCK_NOT_OPEN);
  let torDown = false;
  const b = deps({
    hasSecurityKeys: async () => true,
    torBlocks: () => torDown,
    checkSecurityKey: async () => {
      torDown = true;
    },
  });
  await expect(release('p', b.d)).rejects.toThrow(TOR_NOT_READY);
  let server = PUBLIC;
  const c = deps({
    hasSecurityKeys: async () => true,
    server: () => server,
    checkSecurityKey: async () => {
      server = { host: 'eu.zec.rocks', port: 443 };
    },
  });
  await expect(release('p', c.d)).rejects.toThrow(SERVER_CHANGED_SEND);
  for (const x of [a, b, c]) expect(x.calls).not.toContain('transfer');
});

test('a cancelled Face ID and a missing phrase say different things (C-01)', async () => {
  const cancelled = deps({
    readSeed: async () => {
      throw new Error('User canceled');
    },
  });
  await expect(release('p', cancelled.d)).rejects.toThrow(SEED_NOT_RELEASED);
  const missing = deps({
    readSeed: async () => {
      throw new SeedMissingError();
    },
  });
  await expect(release('p', missing.d)).rejects.toThrow(SEED_MISSING);
  expect(cancelled.calls).not.toContain('transfer');
});

test('created but not delivered: recorded as waiting, never as an ordinary error', async () => {
  const { d, sent } = deps({
    createTransfer: async () => {
      throw Object.assign(new Error('txids:aa,bb detail:timeout'), {
        code: 'SubmitPending',
      });
    },
  });
  const error = await release('p', d).catch(e => e);
  expect(sent).toEqual([{ ids: ['aa', 'bb'], waiting: true }]);
  expect(String(error.message)).toMatch(/not send it again/i);
});

test('a plain engine failure records nothing', async () => {
  const { d, sent } = deps({
    createTransfer: async () => {
      throw new Error('Insufficient balance');
    },
  });
  await expect(release('p', d)).rejects.toThrow();
  expect(sent).toEqual([]);
});
