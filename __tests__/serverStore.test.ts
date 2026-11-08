// Audit C-29: servers live in a this-device-only Keychain item, not in the
// app settings (which go into iCloud and computer backups).
const mockSettings: Record<string, unknown> = {};
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: (key: string) => mockSettings[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mockSettings, values),
  },
}));
const mockKeychain: Record<string, { password: string; accessible?: string }> =
  {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
  getGenericPassword: async (o: { service: string }) =>
    mockKeychain[o.service]
      ? { username: 'servers', password: mockKeychain[o.service].password }
      : false,
  setGenericPassword: async (
    _u: string,
    password: string,
    o: { service: string; accessible?: string },
  ) => {
    mockKeychain[o.service] = { password, accessible: o.accessible };
    return { service: o.service };
  },
  resetGenericPassword: async (o: { service: string }) => {
    delete mockKeychain[o.service];
    return true;
  },
}));

import {
  getSavedServers,
  getServer,
  loadServers,
  saveServer,
  setServer,
} from '../src/lib/server';

const SERVICE = 'app.zecky.lockit.servers';
const tick = () => new Promise<void>(resolve => setTimeout(() => resolve(), 0));

test('the old settings copy moves to the Keychain and is blanked', async () => {
  mockSettings['zecky.server'] = 'home.tail1234.ts.net:9067';
  mockSettings['zecky.savedServers'] = JSON.stringify([
    { name: 'Rock it', address: 'home.tail1234.ts.net:9067', own: true },
  ]);
  await loadServers();
  expect(getServer()).toEqual({ host: 'home.tail1234.ts.net', port: 9067 });
  expect(getSavedServers()[0].own).toBe(true);
  expect(mockKeychain[SERVICE].accessible).toBe('WhenUnlockedThisDeviceOnly');
  expect(mockKeychain[SERVICE].password).toContain('tail1234');
  expect(JSON.stringify(mockSettings)).not.toContain('tail1234');
});

test('changes are written to the Keychain only', async () => {
  setServer({ host: '192.168.1.20', port: 9067 });
  saveServer('Kitchen', { host: '192.168.1.20', port: 9067 });
  await tick();
  expect(mockKeychain[SERVICE].password).toContain('192.168.1.20');
  expect(JSON.stringify(mockSettings)).not.toContain('192.168.1.20');
});
