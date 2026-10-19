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
