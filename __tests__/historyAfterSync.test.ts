// After the first sync of a launch, the app asks the engine for the full
// transaction list again: a new engine can fill in transactions during that
// sync without reporting them as found (seen with the NU7 engine's database
// update: three lines missing until a restart).
export {};

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('fs');

const source = fs.readFileSync('src/wallet/useSynchronizer.ts', 'utf8');

test('the full transaction list is requested once the first sync is done', () => {
  expect(source).toContain(
    "status.name === 'SYNCED' && !resentAfterSync && !cancelled",
  );
  expect(source).toContain('native.emitExistingTransactions(WALLET_ALIAS)');
});

test('a failed request is tried again on the next sync', () => {
  expect(source).toMatch(/\.catch\(\(\) => \{\s*resentAfterSync = false;/);
});
