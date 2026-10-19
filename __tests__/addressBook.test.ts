jest.mock('react-native-keychain', () => ({}));

import { withDefault, withDiscovered } from '../src/lib/addressBook';

test('default address is always last, without duplicates', () => {
  expect(withDefault([], 'd')).toEqual(['d']);
  expect(withDefault(['b', 'a'], 'd')).toEqual(['b', 'a', 'd']);
  expect(withDefault(['b', 'd', 'b', 'a'], 'd')).toEqual(['b', 'a', 'd']);
});

test('paid addresses missing from the saved list are added', () => {
  const saved = ['u1new'];
  expect(withDiscovered(saved, { u1new: 1 }, 'u1first')).toBe(saved);
  expect(
    withDiscovered(saved, { u1old: 2, u1first: 1, t1public: 3 }, 'u1first'),
  ).toEqual(['u1new', 'u1old']);
});
