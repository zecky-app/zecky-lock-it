// The last few sync problems, for the sync details page. Kept in memory
// only: nothing is written to disk, and the list is empty again whenever
// Zecky is closed. No addresses or amounts, only the plain message.

export interface SyncProblem {
  at: number;
  message: string;
}

const MAX = 5;
let problems: SyncProblem[] = [];
const listeners = new Set<() => void>();

export function recordSyncProblem(message: string, at = Date.now()): void {
  const last = problems[0];
  // The same message again within a minute is the same problem.
  if (last != null && last.message === message && at - last.at < 60_000) {
    return;
  }
  problems = [{ at, message }, ...problems].slice(0, MAX);
  listeners.forEach(l => l());
}

export function syncProblems(): SyncProblem[] {
  return problems;
}

export function onSyncProblems(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests. */
export function clearSyncProblems(): void {
  problems = [];
  listeners.forEach(l => l());
}

export interface ScanOverview {
  fullyScanned: number | null;
  maxScanned: number | null;
  /** [first, end) block ranges still to scan, with the engine's priority. */
  toScan: [number, number, number][];
}

/**
 * The parts of [birthday, tip) as fractions 0..1, for the scan map: what is
 * still to scan. Ranges outside the wallet's span are clipped.
 */
export function unscannedSegments(
  overview: ScanOverview,
  birthday: number,
  tip: number,
): { from: number; to: number }[] {
  const span = tip - birthday;
  if (span <= 0) return [];
  return overview.toScan
    .map(([first, end]) => ({
      from: (Math.max(first, birthday) - birthday) / span,
      to: (Math.min(end, tip) - birthday) / span,
    }))
    .filter(s => s.to > s.from);
}

/**
 * How much of [birthday, tip) is checked, 0..1, from the engine's own list
 * of ranges still to scan. Overlapping ranges count once. Null while the
 * network block is not known yet.
 */
export function checkedShare(
  overview: ScanOverview,
  birthday: number,
  tip: number,
): number | null {
  const span = tip - birthday;
  if (tip <= 0 || span <= 0) return null;
  const parts = overview.toScan
    .map(([first, end]) => [Math.max(first, birthday), Math.min(end, tip)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let open = 0;
  let reach = birthday;
  for (const [a, b] of parts) {
    const from = Math.max(a, reach);
    if (b > from) open += b - from;
    reach = Math.max(reach, b);
  }
  return Math.max(0, Math.min(1, (span - open) / span));
}

/**
 * The ring's number, one decimal and rounded down, so a few hundred new
 * blocks after a night still move it. It only says 100 when the wallet
 * really is up to date.
 */
export function ringPercent(share: number, synced: boolean): number {
  if (synced) return 100;
  return Math.min(99.9, Math.floor(share * 1000) / 10);
}
