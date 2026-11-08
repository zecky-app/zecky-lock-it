// Audit C-09: releasing needs an open lock, checked inside the wallet.
import {
  GRANT_MS,
  grantRelease,
  hasReleaseGrant,
  revokeRelease,
} from '../src/lib/releaseGrant';

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
}>('fs');

test('the grant exists only between opening and closing, and lapses', () => {
  revokeRelease();
  expect(hasReleaseGrant(1_000)).toBe(false);
  grantRelease(1_000);
  expect(hasReleaseGrant(1_000 + GRANT_MS - 1)).toBe(true);
  expect(hasReleaseGrant(1_000 + GRANT_MS)).toBe(false);
  grantRelease(1_000);
  revokeRelease();
  expect(hasReleaseGrant(1_001)).toBe(false);
});

test('sendProposal checks the grant before the key, the phrase and the transfer', () => {
  const body = fs.readFileSync('src/wallet/release.ts', 'utf8');
  const grant = body.indexOf('if (!d.hasGrant())');
  expect(grant).toBeGreaterThan(0);
  expect(grant).toBeLessThan(body.indexOf('await d.checkSecurityKey()'));
  expect(grant).toBeLessThan(body.indexOf("d.readSeed('Send Zcash')"));
  expect(grant).toBeLessThan(body.indexOf('d.createTransfer('));
  const sync = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');
  expect(sync).toContain('hasGrant: hasReleaseGrant');
});

test('the grant is only given where the lock opens, and taken when it closes', () => {
  const files = [
    'src/screens/HomeScreen.tsx',
    'src/wallet/useSynchronizer.ts',
    'src/wallet/release.ts',
  ];
  const grants = files.filter(f =>
    /grantRelease\(\)/.test(fs.readFileSync(f, 'utf8')),
  );
  expect(grants).toEqual(['src/screens/HomeScreen.tsx']);
  const home = fs.readFileSync('src/screens/HomeScreen.tsx', 'utf8');
  expect(home).toMatch(
    /if \(lockOpen\) grantRelease\(\);\s*else \{\s*revokeRelease\(\);/,
  );
});

test('one release or lock-in at a time, inside the wallet (C-23)', () => {
  const sync = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');
  expect(sync).toMatch(
    /sendProposal = useCallback<[^>]+>\(\s*proposalBase64 =>\s*oneAtATime\(/,
  );
  expect(sync).toMatch(
    /shieldFunds = useCallback<[^>]+>\(\s*\(\) =>\s*oneAtATime\(/,
  );
});
