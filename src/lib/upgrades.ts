// Zcash network upgrades that change what Zecky has to know.
//
// NU7 (Nov 2026, block 3,543,405): blocks every 25 seconds instead of 75,
// and transactions must carry NU7's stamp (consensus branch ID). The Zecky
// engine (zecky-app/zecky-engine v4.0.0-zecky.3, installed by
// scripts/fetch-engine.sh) is built on the NU7 releases of the official
// Zcash core, so it builds NU7 transactions. The pause below only applies
// when ENGINE_KNOWS_NU7 is false, for an engine that does not know NU7.

export const NU7_HEIGHT = 3_543_405;
export const ENGINE_KNOWS_NU7 = true;

/**
 * Stop building transactions this many blocks before NU7: a transaction
 * built just before activation but mined after it would also be rejected.
 */
export const NU7_MARGIN_BLOCKS = 40;

export const SECONDS_BEFORE_NU7 = 75;
export const SECONDS_AFTER_NU7 = 25;

/** Seconds per block at this height. */
export function blockSeconds(height: number): number {
  return height >= NU7_HEIGHT ? SECONDS_AFTER_NU7 : SECONDS_BEFORE_NU7;
}

// Audit C-42: what the engine linked into the app answers about itself at
// start (null until asked, or when this build cannot ask).
let engineSaysNu7: boolean | null = null;

export function setEngineKnowsNu7(knows: boolean | null): void {
  engineSaysNu7 = knows;
}

/** Whether building transactions is paused for NU7 at this network height. */
export function nu7Pauses(networkHeight: number): boolean {
  const knows = engineSaysNu7 ?? ENGINE_KNOWS_NU7;
  return (
    !knows &&
    networkHeight > 0 &&
    networkHeight >= NU7_HEIGHT - NU7_MARGIN_BLOCKS
  );
}

/**
 * How many blocks cover `seconds`, counted forward from `startHeight`,
 * with 75-second blocks before NU7 and 25-second blocks after it.
 */
export function blocksForSeconds(startHeight: number, seconds: number): number {
  let left = seconds;
  let blocks = 0;
  if (startHeight < NU7_HEIGHT) {
    const before = Math.min(
      NU7_HEIGHT - startHeight,
      Math.ceil(left / SECONDS_BEFORE_NU7),
    );
    blocks += before;
    left -= before * SECONDS_BEFORE_NU7;
  }
  if (left > 0) blocks += Math.ceil(left / SECONDS_AFTER_NU7);
  return blocks;
}

/**
 * How many blocks go back `seconds` from `tipHeight`: 25-second blocks
 * after NU7, 75-second blocks before it.
 */
export function blocksBackForSeconds(
  tipHeight: number,
  seconds: number,
): number {
  let left = seconds;
  let blocks = 0;
  if (tipHeight > NU7_HEIGHT) {
    const after = Math.min(
      tipHeight - NU7_HEIGHT,
      Math.ceil(left / SECONDS_AFTER_NU7),
    );
    blocks += after;
    left -= after * SECONDS_AFTER_NU7;
  }
  if (left > 0) blocks += Math.ceil(left / SECONDS_BEFORE_NU7);
  return blocks;
}
