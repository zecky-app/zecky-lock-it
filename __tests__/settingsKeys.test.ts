// Self-audit K3: the reinstall safety net (freshInstall.ts) must know every
// settings key Zecky writes, or an update could look like a fresh install.
export {};

jest.mock('react-native-keychain', () => ({}));

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string, options: { recursive: boolean }) => string[];
}>('fs');

test('every zecky. settings key is in the reinstall safety net', () => {
  const { SETTINGS_KEYS } = jest.requireActual<{
    SETTINGS_KEYS: readonly string[];
  }>('../src/lib/freshInstall');
  const used = new Set<string>();
  for (const file of fs.readdirSync('src', { recursive: true })) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = fs.readFileSync(`src/${file}`, 'utf8');
    for (const match of text.matchAll(/'(zecky\.[A-Za-z.]+)'/g)) {
      used.add(match[1]);
    }
  }
  used.delete('zecky.installed');
  // The website's domain (security keys are registered for it), not a setting.
  used.delete('zecky.app');
  const missing = [...used].filter(key => !SETTINGS_KEYS.includes(key));
  expect(missing).toEqual([]);
});
