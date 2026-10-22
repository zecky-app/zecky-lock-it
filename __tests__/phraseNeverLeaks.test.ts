// The recovery phrase must never be logged, copied or sent. Every file that
// handles it is scanned for the ways it could leave the phone or the screen.
const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
}>('fs');

const PHRASE_FILES = [
  'App.tsx',
  'src/wallet/seed.ts',
  'src/wallet/entropy.ts',
  'src/wallet/useSynchronizer.ts',
  'src/lib/phraseCheck.ts',
  'src/screens/BackupScreen.tsx',
  'src/screens/ConfirmPhraseScreen.tsx',
  'src/screens/RestoreScreen.tsx',
  'src/screens/SettingsScreen.tsx',
  'src/components/PhraseGrid.tsx',
  'src/components/PhraseCheck.tsx',
];

const FORBIDDEN: [string, RegExp][] = [
  ['logging', /console\./],
  ['the clipboard', /Clipboard|setString\(/],
  ['network requests', /\bfetch\(|XMLHttpRequest|WebSocket\(/],
  ['sharing', /Share\.share\([^)]*(mnemonic|phrase)/],
  ['plain app settings', /Settings\.set\([^)]*(mnemonic|phrase\b)/],
];

test.each(PHRASE_FILES)('%s never logs, copies or sends the phrase', file => {
  const text = fs.readFileSync(file, 'utf8');
  for (const [what, pattern] of FORBIDDEN) {
    expect({ file, what, found: pattern.test(text) }).toEqual({
      file,
      what,
      found: false,
    });
  }
});

test('no console output anywhere in the app', () => {
  const eslint = fs.readFileSync('.eslintrc.js', 'utf8');
  expect(eslint).toMatch(/'no-console':\s*'error'/);
});
