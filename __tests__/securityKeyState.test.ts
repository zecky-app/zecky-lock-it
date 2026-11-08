// Re-check R2: a damaged security key entry never counts as "no keys".
// Audit C-06: the synced height lives in its own item, which also marks
// that keys were set up.
const KEYS = 'app.zecky.lockit.seckeys';
const HEIGHT = 'app.zecky.lockit.seckeysheight';
let mockStore: Record<string, string> = {};
function setStored(value: string | false) {
  mockStore = {};
  if (value !== false) mockStore[KEYS] = value;
}
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  getGenericPassword: jest.fn(async (o: { service: string }) =>
    o.service in mockStore
      ? { username: 'x', password: mockStore[o.service] }
      : false,
  ),
  setGenericPassword: jest.fn(
    async (_u: string, p: string, o: { service: string }) => {
      mockStore[o.service] = p;
      return { service: o.service };
    },
  ),
  resetGenericPassword: jest.fn(async (o: { service: string }) => {
    delete mockStore[o.service];
    return true;
  }),
}));
let mockServer = { host: 'zec.rocks', port: 443 };
jest.mock('../src/lib/server', () => ({
  getServer: () => mockServer,
  sameServer: (
    a: { host: string; port: number },
    b: { host: string; port: number },
  ) => a.host === b.host && a.port === b.port,
  SERVER_PRESETS: [{ label: 'x', server: { host: 'zec.rocks', port: 443 } }],
}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: (n: number) => new Uint8Array(n),
}));

import {
  onPublicServer,
  KeysUnreadableError,
  loadSecurityKeyState,
  noteSyncedHeight,
  startKeyRemoval,
} from '../src/lib/securityKey';

const key = {
  id: 'AAAA',
  publicKey: 'BBBB',
  signCount: 0,
  role: 'main',
  added: '2026-10-27T10:00:00.000Z',
};

test('no entry means no keys', async () => {
  setStored(false);
  expect((await loadSecurityKeyState()).keys).toEqual([]);
});

test('a damaged entry throws instead of switching the keys off', async () => {
  setStored('{not json');
  await expect(loadSecurityKeyState()).rejects.toBeInstanceOf(
    KeysUnreadableError,
  );
  setStored(JSON.stringify({ phraseNeedsKey: true }));
  await expect(loadSecurityKeyState()).rejects.toBeInstanceOf(
    KeysUnreadableError,
  );
});

test('the list from the first version still reads', async () => {
  setStored(JSON.stringify([key]));
  const state = await loadSecurityKeyState();
  expect(state.keys).toHaveLength(1);
  expect(state.heightSeen).toBe(0);
});

test('a removal started from a lower reported height starts at the highest seen', async () => {
  setStored(
    JSON.stringify({
      keys: [key],
      phraseNeedsKey: false,
      removal: null,
      heightSeen: 0,
    }),
  );
  await loadSecurityKeyState();
  await noteSyncedHeight(3_500_000);
  // The height goes to its own item; the key list is not rewritten (C-06).
  expect(JSON.parse(mockStore[HEIGHT]).heightSeen).toBe(3_500_000);
  expect(JSON.parse(mockStore[KEYS]).heightSeen).toBe(0);
  await expect(startKeyRemoval(1)).rejects.toThrow(/behind/);
  await startKeyRemoval(3_499_999);
  const state = await loadSecurityKeyState();
  expect(state.removal?.startHeight).toBe(3_500_000);
});

test('a key list that is gone while the height mark exists blocks instead of counting as no keys (C-06)', async () => {
  setStored(false);
  mockStore[HEIGHT] = JSON.stringify({ heightSeen: 5 });
  await expect(loadSecurityKeyState()).rejects.toBeInstanceOf(
    KeysUnreadableError,
  );
});

test('the 48-hour removal only finishes on a built-in public server (C-28)', () => {
  mockServer = { host: '192.168.1.5', port: 9067 };
  expect(onPublicServer()).toBe(false);
  mockServer = { host: 'zec.rocks', port: 443 };
  expect(onPublicServer()).toBe(true);
});
