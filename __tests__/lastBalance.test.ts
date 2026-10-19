const mockStore = new Map<string, string>();
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
  getGenericPassword: async ({ service }: { service: string }) =>
    mockStore.has(service) ? { password: mockStore.get(service) } : false,
  setGenericPassword: async (
    _user: string,
    password: string,
    { service }: { service: string },
  ) => {
    mockStore.set(service, password);
    return true;
  },
  resetGenericPassword: async ({ service }: { service: string }) =>
    mockStore.delete(service),
}));

import {
  clearLastBalance,
  loadLastBalance,
  saveLastBalance,
} from '../src/lib/lastBalance';

const balances = {
  totalZatoshi: '150000000',
  availableZatoshi: '140000000',
  spendableZatoshi: '140000000',
  transparentZatoshi: '0',
};

test('remembers the balance for the same wallet only', async () => {
  saveLastBalance(3_000_000, balances);
  expect(await loadLastBalance(3_000_000)).toEqual(balances);
  expect(await loadLastBalance(2_900_000)).toBeNull();
});

test('ignores anything that is not a zats amount', async () => {
  mockStore.set(
    'app.zecky.lockit.balance',
    JSON.stringify({ ...balances, birthdayHeight: 1, totalZatoshi: '-5' }),
  );
  expect(await loadLastBalance(1)).toBeNull();
});

test('Erase wallet removes it', async () => {
  saveLastBalance(3_000_000, balances);
  await clearLastBalance();
  expect(await loadLastBalance(3_000_000)).toBeNull();
});
