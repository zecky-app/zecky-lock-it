// NU7 (Nov 2026): 25-second blocks, and a pause on building transactions
// until the engine knows NU7.
import {
  ENGINE_KNOWS_NU7,
  NU7_HEIGHT,
  NU7_MARGIN_BLOCKS,
  blockSeconds,
  blocksBackForSeconds,
  blocksForSeconds,
  nu7Pauses,
} from '../src/lib/upgrades';
import { removalBlocksFrom, removalDue, REMOVAL_MS } from '../src/lib/keyRules';
import { slowestWaiting } from '../src/lib/confirmations';
import { estimateBirthdayHeight } from '../src/lib/birthday';

test('blocks take 75 seconds before NU7 and 25 seconds after', () => {
  expect(blockSeconds(NU7_HEIGHT - 1)).toBe(75);
  expect(blockSeconds(NU7_HEIGHT)).toBe(25);
});

test('the engine knows NU7, so building never pauses for it', () => {
  expect(ENGINE_KNOWS_NU7).toBe(true);
  expect(nu7Pauses(0)).toBe(false);
  expect(nu7Pauses(NU7_HEIGHT - NU7_MARGIN_BLOCKS)).toBe(false);
  expect(nu7Pauses(NU7_HEIGHT)).toBe(false);
  expect(nu7Pauses(NU7_HEIGHT + 1000)).toBe(false);
});

test('the margin before NU7 is still the 40 blocks an old engine would need', () => {
  expect(NU7_MARGIN_BLOCKS).toBe(40);
});

test('the 48-hour removal counts 48 hours of blocks on both sides of NU7', () => {
  expect(removalBlocksFrom(NU7_HEIGHT - 100_000)).toBe(2304);
  expect(removalBlocksFrom(NU7_HEIGHT)).toBe(6912);
  // Starting 1,000 blocks before NU7: 1,000 × 75 s, the rest at 25 s.
  expect(removalBlocksFrom(NU7_HEIGHT - 1000)).toBe(
    1000 + (172800 - 75000) / 25,
  );
  const start = {
    startedAt: '2026-11-06T10:00:00.000Z',
    startHeight: NU7_HEIGHT + 5000,
  };
  const later = new Date(start.startedAt).getTime() + REMOVAL_MS;
  expect(removalDue(start, later, start.startHeight + 2304)).toBe(false);
  expect(removalDue(start, later, start.startHeight + 6912)).toBe(true);
});

test('blocks for a span forward and back', () => {
  expect(blocksForSeconds(NU7_HEIGHT, 250)).toBe(10);
  expect(blocksBackForSeconds(NU7_HEIGHT + 100, 25 * 100 + 75 * 10)).toBe(110);
});

test('confirmation minutes use 25-second blocks after NU7', () => {
  const tx = {
    rawTransactionId: 'a',
    minedHeight: NU7_HEIGHT + 100,
    value: '100000',
    fee: '0',
    isExpired: false,
    toAddress: undefined,
  } as unknown as Parameters<typeof slowestWaiting>[0][number];
  // received, 1/10 confirmations: 9 blocks × 25 s ≈ 4 minutes
  const w = slowestWaiting([tx], NU7_HEIGHT + 100);
  expect(w?.minutes).toBeLessThanOrEqual(4);
});

test('a birthday estimate after NU7 never starts too late', () => {
  // A wallet made on Nov 1 (before NU7), estimated a month after NU7.
  const nu7Time = Date.UTC(2026, 10, 5, 12);
  const now = nu7Time + 30 * 24 * 3600 * 1000;
  const tip = NU7_HEIGHT + (30 * 24 * 3600) / 25;
  const height = estimateBirthdayHeight(2026, 10, tip, now);
  // Nov 1 is ~4.5 days before NU7: about 5,200 blocks of 75 s before it.
  expect(height).toBeLessThan(NU7_HEIGHT - 5000);
});
