import { Platform, Settings } from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { daysSince, Stretch, stretches } from './lockedSince';
import { LEGEND, milestoneDays, YEAR } from './milestones';

// The "Locked for" page: highlights of the current holding and the
// milestone path, all worked out on this phone from the wallet history.

// Every milestone has its own name, rising to Legend at 4 years. Quiet
// words about keeping, never about price or winning.
const NAMES: Record<number, string> = {
  7: 'Locked',
  30: 'Sealed',
  60: 'Bolted',
  90: 'Steady',
  120: 'Anchored',
  150: 'Rooted',
  180: 'Unshaken',
  210: 'Hardened',
  240: 'Vaulted',
  270: 'Fortified',
  300: 'Bedrock',
  330: 'Keeper',
  365: 'Guardian',
  730: 'Sentinel',
  1095: 'Stronghold',
  1460: 'Legend',
};

/** The name of the milestone at `days`; after Legend, Legend with its years. */
export function milestoneName(days: number): string {
  return NAMES[days] ?? `Legend · ${Math.round(days / YEAR)} years`;
}

/** The plain length of the milestone at `days`. */
export function milestoneLength(days: number): string {
  if (days === 7) return '1 week';
  const [n, unit] =
    days < YEAR
      ? [Math.round(days / 30), 'month']
      : [Math.round(days / YEAR), 'year'];
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** The one line shown when a milestone is reached. */
export function milestoneLine(days: number): string {
  const length = milestoneLength(days);
  return `${length.charAt(0).toUpperCase()}${length.slice(1)} in the lock.`;
}

export interface MilestoneStep {
  days: number;
  name: string;
  length: string;
  /** When it was (or will be) reached. */
  at: Date;
  reached: boolean;
  /** For the next one only: how far along, 0 to 1, and days to go. */
  progress?: number;
  inDays?: number;
}

/**
 * The whole milestone path for a holding of `held` days that began on
 * `since`: up to Legend at 4 years, and further when the holding is already
 * past it, always with the next two after the one in progress.
 */
export function milestonePath(since: Date, held: number): MilestoneStep[] {
  const upcoming = (list: number[]) => list.filter(d => d > held).length;
  let list = milestoneDays(Math.max(held, LEGEND));
  while (upcoming(list) < 3) list = milestoneDays(list[list.length - 1]);
  const shown = list.filter(
    d => d <= Math.max(held, LEGEND) || upcoming(list.filter(x => x < d)) < 3,
  );
  const day0 = new Date(since.getFullYear(), since.getMonth(), since.getDate());
  let prev = 0;
  let nextSeen = false;
  return shown.map(d => {
    const at = new Date(day0);
    at.setDate(at.getDate() + d);
    const step: MilestoneStep = {
      days: d,
      name: milestoneName(d),
      length: milestoneLength(d),
      at,
      reached: d <= held,
    };
    if (!step.reached && !nextSeen) {
      nextSeen = true;
      step.progress = (held - prev) / (d - prev);
      step.inDays = d - held;
    }
    prev = d;
    return step;
  });
}

/** The short view: the last milestone reached (if any) and the next two. */
export function shortPath(path: MilestoneStep[]): MilestoneStep[] {
  const next = path.findIndex(s => !s.reached);
  const from = next <= 0 ? 0 : next - 1;
  return path.slice(from, from + 3);
}

export interface Pace {
  /** Received per period, rounded to 3 significant digits so it reads calmly. */
  zatoshi: bigint;
  per: 'day' | 'week' | 'month';
}

/**
 * Stacking pace: what came in since the start, divided by the time held,
 * in a period that fits that time: per day in the first week, per week up
 * to 3 months, then per month (30 days). Null on the first day.
 */
export function stackingPace(received: bigint, days: number): Pace | null {
  if (days < 1 || received <= 0n) return null;
  const [per, length]: [Pace['per'], number] =
    days < 7 ? ['day', 1] : days < 90 ? ['week', 7] : ['month', 30];
  const exact = (received * BigInt(length)) / BigInt(Math.floor(days));
  const digits = exact.toString().length;
  const step = digits > 3 ? 10n ** BigInt(digits - 3) : 1n;
  return { zatoshi: ((exact + step / 2n) / step) * step, per };
}

export interface Holding {
  since: Date;
  days: number;
  current: Stretch;
  /** The longest earlier stretch, only when it was longer than now. */
  longestBefore: { days: number; start: Date; end: Date } | null;
}

export function holding(
  transactions: Transaction[],
  now: Date = new Date(),
): Holding | null {
  const list = stretches(transactions);
  const current = list[list.length - 1];
  if (current == null || current.end != null) return null;
  const days = daysSince(current.start, now);
  let longestBefore: Holding['longestBefore'] = null;
  for (const s of list.slice(0, -1)) {
    if (s.end == null) continue;
    const length = daysSince(s.start, s.end);
    if (
      length > days &&
      (longestBefore == null || length > longestBefore.days)
    ) {
      longestBefore = { days: length, start: s.start, end: s.end };
    }
  }
  return { since: current.start, days, current, longestBefore };
}

// The milestone moment is shown once: the first time the page opens on the
// day it is reached. Only which milestone of which holding is remembered.
const SEEN_KEY = 'zecky.milestone.seen';

const seenId = (since: Date, days: number) => `${since.getTime()}:${days}`;

export function momentSeen(since: Date, days: number): boolean {
  try {
    return (
      Platform.OS === 'ios' && Settings.get(SEEN_KEY) === seenId(since, days)
    );
  } catch {
    return false;
  }
}

export function markMomentSeen(since: Date, days: number): void {
  try {
    if (Platform.OS === 'ios')
      Settings.set({ [SEEN_KEY]: seenId(since, days) });
  } catch {
    // Shown again next time: harmless.
  }
}

/** For Erase wallet. */
export function resetMoment(): void {
  try {
    if (Platform.OS === 'ios') Settings.set({ [SEEN_KEY]: null });
  } catch {
    // Applies until the app is closed.
  }
}
