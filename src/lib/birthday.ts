import { EARLIEST_BIRTHDAY_HEIGHT } from '../config';

// Zcash makes a block every 75 seconds since the Blossom upgrade
// (block 653,600, 11 December 2019) and every 150 seconds before it.
const BLOSSOM_HEIGHT = 653_600;
const BLOSSOM_TIME = Date.UTC(2019, 11, 11, 18, 0, 0);
const SECONDS_NOW = 75;
const SECONDS_BEFORE_BLOSSOM = 150;

// Real block times drift a little, and starting too late would miss funds,
// so always aim a few percent (plus about two days) too early.
const MARGIN = 1.03;
const EXTRA_BLOCKS = 2_000;

/** A rough chain height for "now", for when the network can't be asked. */
export function estimateTipHeight(nowMs: number): number {
  return (
    BLOSSOM_HEIGHT + Math.floor((nowMs - BLOSSOM_TIME) / 1000 / SECONDS_NOW)
  );
}

/**
 * The block to start scanning from for a wallet created in the given month
 * (monthIndex 0 = January). Deliberately errs on the early side.
 */
export function estimateBirthdayHeight(
  year: number,
  monthIndex: number,
  tipHeight: number,
  nowMs: number,
): number {
  const target = Date.UTC(year, monthIndex, 1);
  let height: number;
  if (target >= BLOSSOM_TIME) {
    const secondsBack = Math.max(0, (nowMs - target) / 1000);
    height = tipHeight - Math.ceil((secondsBack / SECONDS_NOW) * MARGIN);
  } else {
    const secondsBefore = (BLOSSOM_TIME - target) / 1000;
    height =
      BLOSSOM_HEIGHT -
      Math.ceil((secondsBefore / SECONDS_BEFORE_BLOSSOM) * MARGIN);
  }
  height -= EXTRA_BLOCKS;
  return Math.min(tipHeight, Math.max(EARLIEST_BIRTHDAY_HEIGHT, height));
}
