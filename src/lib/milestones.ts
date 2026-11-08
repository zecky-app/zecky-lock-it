// Milestones for holding: 1 week, then every month of the first year
// (months of 30 days, as in the "Locked for" line), 1 year, then every
// year (365 days). 4 years is Legend, the end of the named path.
export const YEAR = 365;
export const LEGEND = 4 * YEAR;

/** Every milestone day up to and including `upTo`, plus the first after it. */
export function milestoneDays(upTo: number): number[] {
  const list = [7];
  for (let m = 1; m <= 11; m++) list.push(30 * m);
  for (let y = 1; list[list.length - 1] <= upTo; y++) list.push(YEAR * y);
  return list;
}

export interface MilestoneState {
  /** How far along the way from the previous milestone, 0 to 1. */
  progress: number;
  /** True only on the day a milestone is reached: the ring is full and glows. */
  reachedToday: boolean;
}

export function milestoneState(days: number): MilestoneState {
  const held = Math.max(0, Math.floor(days));
  const list = milestoneDays(held);
  if (held > 0 && list.includes(held)) {
    return { progress: 1, reachedToday: true };
  }
  const next = list.find(m => m > held) ?? list[list.length - 1];
  const prev = [0, ...list].filter(m => m < next).pop() ?? 0;
  return { progress: (held - prev) / (next - prev), reachedToday: false };
}
