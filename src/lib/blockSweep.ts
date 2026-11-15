// The block sweep: one short gold light around the ring on Home when a new
// block arrives, and the block number for a moment, as on Lock it Mac and
// Windows. Purely visual: it follows
// the network height the wallet already reports, and asks nothing new.

export interface SweepContext {
  /** The wallet is up to date (at the tip, not catching up). */
  synced: boolean;
  /** Zecky is on screen (AppState "active"). */
  foreground: boolean;
  /** Reduce Motion is on in iOS settings. */
  reduceMotion: boolean;
}

export interface Beat {
  /** Show "BLOCK 3,551,234" for a moment. */
  label: boolean;
  /** Run the gold light around the ring (never with Reduce Motion). */
  light: boolean;
}

/**
 * What a change of the network height from `previous` to `next` shows, as
 * on Lock it Mac: only for a real new block (not the first report after
 * start, not a lower height after a server switch), only on screen and at
 * the tip. With Reduce Motion on, the number shows without the light.
 */
export function blockBeat(
  previous: number,
  next: number,
  context: SweepContext,
): Beat {
  const beat =
    previous > 0 && next > previous && context.synced && context.foreground;
  return { label: beat, light: beat && !context.reduceMotion };
}
