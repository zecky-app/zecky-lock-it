// Re-check R2: a damaged security key entry never counts as "no keys".
let mockStored: string | false = false;
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  getGenericPassword: jest.fn(async () =>
    mockStored === false ? false : { username: 'keys', password: mockStored },
  ),
  setGenericPassword: jest.fn(async (_u: string, p: string) => {
    mockStored = p;
    return { service: 'x' };
  }),
  resetGenericPassword: jest.fn(async () => {
    mockStored = false;
    return true;
  }),
}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: (n: number) => new Uint8Array(n),
}));

import {
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
  mockStored = false;
  expect((await loadSecurityKeyState()).keys).toEqual([]);
});

test('a damaged entry throws instead of switching the keys off', async () => {
  mockStored = '{not json';
  await expect(loadSecurityKeyState()).rejects.toBeInstanceOf(
    KeysUnreadableError,
  );
  mockStored = JSON.stringify({ phraseNeedsKey: true });
  await expect(loadSecurityKeyState()).rejects.toBeInstanceOf(
    KeysUnreadableError,
  );
});

test('the list from the first version still reads', async () => {
  mockStored = JSON.stringify([key]);
  const state = await loadSecurityKeyState();
  expect(state.keys).toHaveLength(1);
  expect(state.heightSeen).toBe(0);
});

test('a removal started from a lower reported height starts at the highest seen', async () => {
  mockStored = JSON.stringify({
    keys: [key],
    phraseNeedsKey: false,
    removal: null,
    heightSeen: 0,
  });
  await loadSecurityKeyState();
  await noteSyncedHeight(3_500_000);
  await expect(startKeyRemoval(1)).rejects.toThrow(/behind/);
  await startKeyRemoval(3_499_999);
  const state = await loadSecurityKeyState();
  expect(state.removal?.startHeight).toBe(3_500_000);
});
