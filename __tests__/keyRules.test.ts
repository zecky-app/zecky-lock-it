// The rules around security keys: what each action asks, and the 48-hour
// "Lost my keys" removal.
import {
  REMOVAL_BLOCKS,
  REMOVAL_MS,
  keyActionAsks,
  removalDue,
  removalEndsAt,
} from '../src/lib/keyRules';

const start = { startedAt: '2026-10-27T10:00:00.000Z', startHeight: 3_500_000 };
const t0 = new Date(start.startedAt).getTime();

test('nothing is due without a removal', () => {
  expect(removalDue(null, t0 + REMOVAL_MS * 10, 9_999_999)).toBe(false);
});

test('the removal needs both 48 hours on the clock and 48 hours of blocks', () => {
  const later = t0 + REMOVAL_MS;
  const enoughBlocks = start.startHeight + REMOVAL_BLOCKS;
  expect(removalDue(start, later, enoughBlocks)).toBe(true);
  // Clock set forward, network not there yet.
  expect(removalDue(start, t0 + REMOVAL_MS * 100, enoughBlocks - 1)).toBe(
    false,
  );
  // Network there, clock not.
  expect(removalDue(start, later - 1, enoughBlocks + 10_000)).toBe(false);
});

test('a removal without a known height never finishes', () => {
  expect(
    removalDue({ ...start, startHeight: 0 }, t0 + REMOVAL_MS, 9_999_999),
  ).toBe(false);
  expect(
    removalDue({ ...start, startedAt: 'nonsense' }, t0 + REMOVAL_MS, 9_999_999),
  ).toBe(false);
});

test('48 hours of blocks at 75 seconds each', () => {
  expect(REMOVAL_BLOCKS * 75 * 1000).toBe(REMOVAL_MS);
  expect(removalEndsAt(start).toISOString()).toBe('2026-10-29T10:00:00.000Z');
});

test('anything that weakens the keys asks a key, once one is paired', () => {
  for (const action of [
    'addMore',
    'remove',
    'phraseOff',
    'cancelRemoval',
  ] as const) {
    expect(keyActionAsks(action, 1)).toBe('key');
    expect(keyActionAsks(action, 2)).toBe('key');
  }
});

test('the first key and the 48-hour removal ask that it is you; the rest asks nothing', () => {
  expect(keyActionAsks('addFirst', 0)).toBe('owner');
  expect(keyActionAsks('startRemoval', 2)).toBe('owner');
  expect(keyActionAsks('phraseOn', 2)).toBe('none');
  expect(keyActionAsks('test', 1)).toBe('none');
});

test('the library enforces the key taps itself, not only the screen', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const text = fs.readFileSync('src/lib/securityKey.ts', 'utf8');
  const body = (name: string) => {
    const from = text.indexOf(`export async function ${name}(`);
    return text.slice(from, text.indexOf('\n}\n', from));
  };
  expect(body('removeSecurityKey')).toContain('await checkSecurityKey()');
  expect(body('cancelKeyRemoval')).toContain('await checkSecurityKey()');
  expect(body('setPhraseNeedsKey')).toContain('await checkSecurityKey()');
  expect(body('addSecurityKey')).toMatch(
    /keys\.length > 0\) await checkSecurityKey\(\)/,
  );
});

test('releasing asks the security key right before the transfer is made', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const text = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');
  const from = text.indexOf('const sendProposal = useCallback');
  const body = text.slice(from, text.indexOf('const shieldFunds', from));
  const check = body.indexOf('await checkSecurityKey()');
  const transfer = body.indexOf('createTransfer(');
  expect(check).toBeGreaterThan(0);
  expect(transfer).toBeGreaterThan(check);
  // Locking in from the public address is not a release and asks no key.
  const shield = text.slice(text.indexOf('const shieldFunds'));
  expect(shield.slice(0, shield.indexOf('useCallback', 30))).not.toContain(
    'checkSecurityKey',
  );
});

// Re-check R1: a server reporting a lower height cannot shorten the wait.
test('a removal never starts below the highest synced height seen', () => {
  const { removalStartHeight, BEHIND_TOLERANCE } = jest.requireActual<
    typeof import('../src/lib/keyRules')
  >('../src/lib/keyRules');
  expect(removalStartHeight(0, 3_500_000)).toBeNull();
  expect(removalStartHeight(1, 3_500_000)).toBeNull();
  expect(
    removalStartHeight(3_500_000 - BEHIND_TOLERANCE - 1, 3_500_000),
  ).toBeNull();
  expect(removalStartHeight(3_499_995, 3_500_000)).toBe(3_500_000);
  expect(removalStartHeight(3_500_100, 3_500_000)).toBe(3_500_100);
  expect(removalStartHeight(3_500_100, 0)).toBe(3_500_100);
});

test('the wait counts only synced heights, and a server switch restarts it', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const home = fs.readFileSync('src/screens/HomeScreen.tsx', 'utf8');
  expect(home).toContain(
    'const syncedHeight = synced ? state.networkHeight : 0;',
  );
  expect(home).toContain('networkHeight={synced ? state.networkHeight : 0}');
  const serverPage = fs.readFileSync(
    'src/screens/settings/ServerPage.tsx',
    'utf8',
  );
  const i = serverPage.indexOf('await restartKeyRemovalIfRunning()');
  expect(i).toBeGreaterThan(0);
  expect(serverPage.indexOf('setServer(server)', i)).toBeGreaterThan(i);
});

test('after the key tap, Tor and the server are checked again (R7)', () => {
  const fs = jest.requireActual<{
    readFileSync: (path: string, encoding: string) => string;
  }>('fs');
  const text = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');
  const from = text.indexOf('await checkSecurityKey()');
  const transfer = text.indexOf('createTransfer(', from);
  const between = text.slice(from, transfer);
  expect(between).toContain(
    'torBlocksRelease(getTorWanted(), torStatus.current)',
  );
  expect(between).toContain('sameServer(getServer(), current)');
});
