// Audit C-36 (with phraseNeverLeaks.test.ts): the recovery phrase is only
// ever written to its own Keychain items, checked by running the real code
// against a fake Keychain and fake app settings, and no share or clipboard
// call anywhere in the app passes a phrase-like value.
const settingsWrites: string[] = [];
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  NativeModules: {},
  Settings: {
    get: () => undefined,
    set: (values: Record<string, unknown>) =>
      settingsWrites.push(JSON.stringify(values)),
  },
}));
const keychain: Record<string, { username: string; password: string }> = {};
const keychainWrites: { service: string; text: string }[] = [];
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'u',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'p',
  },
  ACCESS_CONTROL: { BIOMETRY_ANY_OR_DEVICE_PASSCODE: 'b' },
  isPasscodeAuthAvailable: async () => true,
  hasGenericPassword: async (o: { service: string }) => o.service in keychain,
  getGenericPassword: async (o: { service: string }) =>
    keychain[o.service] ?? false,
  setGenericPassword: async (
    username: string,
    password: string,
    o: { service: string },
  ) => {
    keychain[o.service] = { username, password };
    keychainWrites.push({ service: o.service, text: username + password });
    return { service: o.service };
  },
  resetGenericPassword: async (o: { service: string }) => {
    delete keychain[o.service];
    return true;
  },
}));
jest.mock('../src/wallet/nativeRandom', () => ({
  osRandomBytes: () => new Uint8Array(0),
}));

import { guardIfPossible, readSeed, saveWallet } from '../src/wallet/seed';
import { loadSentLog, recordSent } from '../src/lib/sentLog';
import { loadServers, setServer } from '../src/lib/server';
import { release } from '../src/wallet/release';

const PHRASE =
  'abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual';
const PHRASE_SERVICES = [
  'app.zecky.lockit.seedguarded',
  'app.zecky.lockit.seed',
];
const tick = () => new Promise<void>(r => setTimeout(() => r(), 0));

test('the phrase is written only to its own Keychain items', async () => {
  await loadSentLog();
  await loadServers();
  const keys = await saveWallet({ mnemonic: PHRASE, birthdayHeight: 1 }, 'u');
  await guardIfPossible(keys);
  const seed = await readSeed('test');
  expect(seed).toBe(PHRASE);
  await release('proposal', {
    walletLive: () => true,
    hasGrant: () => true,
    nu7Paused: () => false,
    torBlocks: () => false,
    isOnline: async () => true,
    server: () => ({ host: 'zec.rocks', port: 443 }),
    canReachHomeNode: async () => true,
    hasSecurityKeys: async () => false,
    checkSecurityKey: async () => undefined,
    readSeed,
    createTransfer: async () => 'txid',
    recordSent,
    nativeMessage: e => String(e),
  });
  setServer({ host: 'eu.zec.rocks', port: 443 });
  await tick();
  const firstWord = PHRASE.split(' ')[0];
  for (const write of keychainWrites) {
    if (PHRASE_SERVICES.includes(write.service)) continue;
    expect(write.text).not.toContain(firstWord + ' ');
  }
  for (const write of settingsWrites) {
    expect(write).not.toContain(firstWord + ' ');
  }
  expect(keychainWrites.some(w => w.service === 'app.zecky.lockit.sent')).toBe(
    true,
  );
});

test('no share or clipboard call anywhere passes a phrase-like value', () => {
  const fs = jest.requireActual<{
    readdirSync: (dir: string) => string[];
    statSync: (p: string) => { isDirectory: () => boolean };
    readFileSync: (p: string, encoding: string) => string;
  }>('fs');
  const path = jest.requireActual<{ join: (...parts: string[]) => string }>(
    'path',
  );
  const files: string[] = ['App.tsx'];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) files.push(full);
    }
  };
  walk('src');
  const risky =
    /(Share\.share|Clipboard\.setString|Settings\.set)\(([^;]*?)\)/g;
  const phraseLike = /\b(words|mnemonic|phrase|seed)\b/i;
  const found: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(risky)) {
      if (phraseLike.test(m[2])) found.push(`${file}: ${m[0].slice(0, 80)}`);
    }
  }
  expect(found).toEqual([]);
});
