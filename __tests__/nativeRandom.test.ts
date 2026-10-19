const mockNative = { getRandomBase64: jest.fn() };
jest.mock('react-native', () => ({
  TurboModuleRegistry: {
    getEnforcing: (name: string) => {
      if (name !== 'RNGetRandomValues') throw new Error('unexpected module');
      return mockNative;
    },
  },
}));

import { decodeBase64, osRandomBytes } from '../src/wallet/nativeRandom';

test('decodes base64 exactly', () => {
  expect(Array.from(decodeBase64('AAEC/f7/'))).toEqual([
    0, 1, 2, 253, 254, 255,
  ]);
  expect(Array.from(decodeBase64('AQ=='))).toEqual([1]);
  expect(Array.from(decodeBase64('AQI='))).toEqual([1, 2]);
  expect(() => decodeBase64('not base64!')).toThrow();
});

test('asks the native secure generator and checks the length', () => {
  mockNative.getRandomBase64.mockReturnValue('AAEC/f7/');
  expect(Array.from(osRandomBytes(6))).toEqual([0, 1, 2, 253, 254, 255]);
  expect(mockNative.getRandomBase64).toHaveBeenCalledWith(6);
  // Too little data must be an error, not a shorter key.
  expect(() => osRandomBytes(32)).toThrow(/too little data/);
});
