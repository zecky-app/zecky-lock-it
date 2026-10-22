// Milestones for holding, the same as Lock it on the Mac: one week, one
// month, 100 days, one year, two years, five years.
export const MILESTONES: readonly { days: number; name: string }[] = [
  { days: 7, name: '1 week' },
  { days: 30, name: '1 month' },
  { days: 100, name: '100 days' },
  { days: 365, name: '1 year' },
  { days: 730, name: '2 years' },
  { days: 1825, name: '5 years' },
];

export interface NextMilestone {
  name: string;
  /** Days still to go. */
  inDays: number;
  /** How far along the way from the previous milestone, 0 to 1. */
  progress: number;
}

/** The next milestone after `days` held, or null after five years. */
export function nextMilestone(days: number): NextMilestone | null {
  const held = Math.max(0, Math.floor(days));
  const i = MILESTONES.findIndex(m => m.days > held);
  if (i === -1) return null;
  const start = i === 0 ? 0 : MILESTONES[i - 1].days;
  const target = MILESTONES[i].days;
  return {
    name: MILESTONES[i].name,
    inDays: target - held,
    progress: (held - start) / (target - start),
  };
}
