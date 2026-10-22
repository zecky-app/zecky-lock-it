// The safety rules of the lock, kept apart from the screens so every
// combination can be tested. See How Zecky works › Keys to the lock.

export type TapStep =
  /** The lock is open: tapping it goes to Release. */
  | 'release'
  /** Not up to date or offline: the lock stays shut and says why. */
  | 'notReady'
  /** Question and check both switched off: open at once. */
  | 'openNow'
  /** No question, check on, no Zecky code: straight to Face ID. */
  | 'deviceCheck'
  /** "Really open the lock?" (or, with no question, the code pad). */
  | 'ask';

export interface TapState {
  lockOpen: boolean;
  synced: boolean;
  /** Seconds of "Really open the lock?"; 0 = no question. */
  wait: number;
  /** Ask that it is you (code or Face ID) before opening. */
  check: boolean;
  codeSet: boolean;
}

/** What tapping the lock on Home does. */
export function tapLockStep(s: TapState): TapStep {
  if (s.lockOpen) return 'release';
  if (!s.synced) return 'notReady';
  if (s.wait === 0 && !s.check) return 'openNow';
  if (s.wait === 0 && !s.codeSet) return 'deviceCheck';
  return 'ask';
}

export type KeysChange =
  | { kind: 'ask'; from: boolean; to: boolean }
  | { kind: 'wait'; from: number; to: number }
  | { kind: 'newCode' }
  | { kind: 'codeOff' };

/**
 * Whether a change in Keys to the lock must first ask that it is the
 * owner. Anything that makes the lock easier to open does; making it
 * stricter does not. A new Zecky code always does: whoever sets it could
 * use it to switch every check off.
 */
export function needsOwner(change: KeysChange): boolean {
  switch (change.kind) {
    case 'ask':
      return change.from && !change.to;
    case 'wait':
      return change.to < change.from;
    case 'newCode':
    case 'codeOff':
      return true;
  }
}
