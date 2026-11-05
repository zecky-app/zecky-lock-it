import { EARLIEST_BIRTHDAY_HEIGHT } from '../config';
import {
  NU7_HEIGHT,
  SECONDS_AFTER_NU7,
  blocksBackForSeconds,
} from './upgrades';

// Zcash makes a block every 25 seconds since NU7 (block 3,543,405, about
// 5 November 2026), every 75 seconds since the Blossom upgrade (block
// 653,600, 11 December 2019) and every 150 seconds before it.
const BLOSSOM_HEIGHT = 653_600;
const BLOSSOM_TIME = Date.UTC(2019, 11, 11, 18, 0, 0);
const SECONDS_NOW = 75;
const SECONDS_BEFORE_BLOSSOM = 150;

// Real block times drift a little, and starting too late would miss funds,
// so always aim a few percent (plus about two days) too early.
const MARGIN = 1.03;
const EXTRA_BLOCKS = 2_000;

// Roughly when NU7 activated. Only used for the rough "now" below.
const NU7_TIME = Date.UTC(2026, 10, 5, 12, 0, 0);

/** A rough chain height for "now", for when the network can't be asked. */
export function estimateTipHeight(nowMs: number): number {
  if (nowMs >= NU7_TIME) {
    return (
      NU7_HEIGHT + Math.floor((nowMs - NU7_TIME) / 1000 / SECONDS_AFTER_NU7)
    );
  }
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
    height =
      tipHeight -
      Math.ceil(blocksBackForSeconds(tipHeight, secondsBack) * MARGIN);
  } else {
    const secondsBefore = (BLOSSOM_TIME - target) / 1000;
    height =
      BLOSSOM_HEIGHT -
      Math.ceil((secondsBefore / SECONDS_BEFORE_BLOSSOM) * MARGIN);
  }
  height -= EXTRA_BLOCKS;
  return Math.min(tipHeight, Math.max(EARLIEST_BIRTHDAY_HEIGHT, height));
}
