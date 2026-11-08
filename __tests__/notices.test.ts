// Audit C-54: the Acknowledgements page lists the open-source software that
// ships in the app, from src/lib/notices.json (scripts/notices.js).
import notices from '../src/lib/notices.json';

test('the notices cover the engine, JavaScript, iOS and fonts', () => {
  const titles = notices.sections.map(s => s.title);
  expect(titles).toEqual([
    'Zcash engine',
    'JavaScript packages',
    'iOS libraries',
    'Fonts',
  ]);
  const names = notices.sections.flatMap(s => s.items.map(i => i.n));
  for (const name of [
    'react-native-zcash',
    'react-native-keychain',
    'MnemonicSwift',
    'SwiftNIOSSL',
  ]) {
    expect(names).toContain(name);
  }
});

test('every licence reference points at a stored text', () => {
  for (const section of notices.sections) {
    for (const item of section.items) {
      expect(item.t).toBeLessThan(notices.texts.length);
      if (item.t >= 0) expect(notices.texts[item.t].length).toBeGreaterThan(20);
    }
  }
});
