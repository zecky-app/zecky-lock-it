import { recommendedIosUpdate } from '../src/lib/iosVersion';

test('iOS versions open to DarkSword get a quiet update note', () => {
  expect(recommendedIosUpdate('18.4')).toBe('18.7.6');
  expect(recommendedIosUpdate('18.7.3')).toBe('18.7.6');
  expect(recommendedIosUpdate('17.6.1')).toBe('18.7.6');
  expect(recommendedIosUpdate('26.0')).toBe('26.3.1');
  expect(recommendedIosUpdate('26.3')).toBe('26.3.1');
});

test('patched versions see nothing', () => {
  expect(recommendedIosUpdate('18.7.6')).toBeNull();
  expect(recommendedIosUpdate('18.8')).toBeNull();
  expect(recommendedIosUpdate('26.3.1')).toBeNull();
  expect(recommendedIosUpdate('26.4')).toBeNull();
  expect(recommendedIosUpdate('27.0')).toBeNull();
});
