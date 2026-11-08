// Audit C-44 and the start-up status: before iOS has reported the
// connection, sending counts the phone as offline, while the screen waits
// for the answer instead of showing "No internet connection".
import { NativeModules } from 'react-native';
import { isOnline, onlineState } from '../src/lib/network';

const answer = (v: unknown) => {
  NativeModules.RNZcash = { isOnline: jest.fn(async () => v) };
};

test('not reported yet: unknown for the screen, offline for sending', async () => {
  answer(null);
  expect(await onlineState()).toBeNull();
  expect(await isOnline()).toBe(false);
});

test('reported: online and offline pass through', async () => {
  answer(true);
  expect(await onlineState()).toBe(true);
  expect(await isOnline()).toBe(true);
  answer(false);
  expect(await onlineState()).toBe(false);
  expect(await isOnline()).toBe(false);
});
