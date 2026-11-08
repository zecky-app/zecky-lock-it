import { hasLink } from '../src/lib/memo';

test('spots web addresses in notes', () => {
  expect(hasLink('Claim your reward at https://zec-bonus.example')).toBe(true);
  expect(hasLink('visit www.free-zec.xyz now')).toBe(true);
  expect(hasLink('go to zcash-airdrop.io')).toBe(true);
});

test('leaves ordinary notes alone', () => {
  expect(hasLink('Thanks for dinner')).toBe(false);
  expect(hasLink('Invoice 12. Paid in full.')).toBe(false);
  expect(hasLink('3.5 hours at 0.01')).toBe(false);
});

test('notes are cut at 512 UTF-8 bytes, at a whole character (C-18)', () => {
  const { fitMemo, memoBytes } = jest.requireActual('../src/lib/memo');
  expect(memoBytes('abc')).toBe(3);
  expect(memoBytes('é')).toBe(2);
  expect(memoBytes('😀')).toBe(4);
  const emoji = fitMemo('😀'.repeat(200));
  expect(memoBytes(emoji)).toBe(512);
  expect([...emoji].length).toBe(128);
  expect(memoBytes(fitMemo('a'.repeat(600)))).toBe(512);
  expect(fitMemo('a'.repeat(511) + 'é')).toBe('a'.repeat(511));
});
