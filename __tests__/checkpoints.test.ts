// The chain checkpoints bundled with the Zcash engine set where a new or
// restored wallet starts scanning: the newest checkpoint at or below its
// birthday. Old checkpoints make every new wallet scan blocks it does not
// need, so this fails when they fall behind what the app last shipped.
export {};

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string) => string[];
}>('fs');

const dir =
  'node_modules/react-native-zcash/ios/ZCashLightClientKit/Resources/checkpoints';
const newest = (network: string) =>
  Math.max(
    ...fs
      .readdirSync(`${dir}/${network}`)
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => Number(f.replace('.json', ''))),
  );

test('mainnet checkpoints reach at least block 3,550,000', () => {
  expect(newest('mainnet')).toBeGreaterThanOrEqual(3_550_000);
});

test('testnet checkpoints reach at least block 4,590,000', () => {
  expect(newest('testnet')).toBeGreaterThanOrEqual(4_590_000);
});

test('every new mainnet checkpoint is a tree state for its own height', () => {
  for (let h = 3_502_500; h <= 3_550_000; h += 2_500) {
    const cp = JSON.parse(fs.readFileSync(`${dir}/mainnet/${h}.json`, 'utf8'));
    expect(cp.network).toBe('main');
    expect(Number(cp.height)).toBe(h);
    expect(cp.hash).toMatch(/^[0-9a-f]{64}$/);
  }
});
