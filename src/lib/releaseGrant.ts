// Audit C-09: the lock's own checks (the Zecky code, Face ID or the
// passcode, the "Really open the lock?" wait) run on the main screen. This
// grant carries their result to the wallet: it exists only while the lock
// is open, lives in memory only, and lapses with the lock's two-minute
// window. sendProposal refuses without it, so no screen can release Zcash
// without the lock having been opened first.

/** A little longer than the lock's own two minutes, as a backstop. */
export const GRANT_MS = 2 * 60 * 1000 + 5_000;

let until = 0;

/** Called when the lock opens, after its checks passed. */
export function grantRelease(now: number = Date.now()): void {
  until = now + GRANT_MS;
}

/** Called whenever the lock closes, for any reason. */
export function revokeRelease(): void {
  until = 0;
}

export function hasReleaseGrant(now: number = Date.now()): boolean {
  return until > now;
}
