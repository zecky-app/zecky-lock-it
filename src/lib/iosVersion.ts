// The DarkSword exploit (iOS 18.4–18.7, March 2026) reads files from the
// iPhone, including Keychain-related files and wallet data. Apple fixed it
// in iOS 18.7.x and 26.3; researchers recommend 18.7.6 or 26.3.1. Zecky
// shows one quiet line under Security when the iPhone is older.

const PATCHED: Record<number, [number, number, number]> = {
  18: [18, 7, 6],
  26: [26, 3, 1],
};

function parse(version: string): [number, number, number] {
  const [a, b, c] = version.split('.').map(n => parseInt(n, 10) || 0);
  return [a ?? 0, b ?? 0, c ?? 0];
}

function below(v: [number, number, number], min: [number, number, number]) {
  for (let i = 0; i < 3; i++) {
    if (v[i] !== min[i]) return v[i] < min[i];
  }
  return false;
}

/** The iOS version to update to, or null when this one is fine. */
export function recommendedIosUpdate(version: string): string | null {
  const v = parse(version);
  const min = PATCHED[v[0]];
  if (min != null) return below(v, min) ? min.join('.') : null;
  // Before iOS 18 there is no patched release of that line.
  if (v[0] < 18) return PATCHED[18].join('.');
  // iOS 19–25 do not exist; anything newer than 26 is fine.
  return null;
}
