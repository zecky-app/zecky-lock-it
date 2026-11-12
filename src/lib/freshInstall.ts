import { NativeModules, Platform, Settings } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { NETWORK, WALLET_ALIAS } from '../config';

// iOS keeps Keychain items after an app is deleted, so a reinstalled Zecky
// would find the old recovery phrase again. Deleting Zecky should remove the
// wallet, so the first start after an install clears what an earlier install
// left behind.
//
// The app's settings store is deleted together with the app, so a missing
// flag there means "first start of this install". Versions before 0.0.11 did
// not set the flag, so an update from them looks the same. The wallet's own
// files tell the two apart: an update keeps them, deleting the app does not.
// Any of Zecky's own settings also means an update, as a second safety net:
// they live in the same store as the flag and go with the app.
const KEY = 'zecky.installed';
/** What the last check saw (diagnostics, no secrets; not shown in the app). */
const CHECK_KEY = 'zecky.installcheck';
/** Every settings key Zecky writes, except the install flag itself. */
export const SETTINGS_KEYS = [
  'zecky.phraseUnconfirmed',
  'zecky.server',
  'zecky.savedServers',
  'zecky.tor',
  'zecky.theme',
  'zecky.unit',
  'zecky.hideAmounts',
  'zecky.currency',
  'zecky.sent',
  'zecky.openWait',
  'zecky.ask.start',
  'zecky.ask.openLock',
  'zecky.tour.seen',
  'zecky.milestone.seen',
  'zecky.terms.accepted',
  'zecky.installcheck',
];

/** Every Keychain item Zecky keeps. Add new ones here and in eraseWallet. */
export const KEYCHAIN_SERVICES = [
  'app.zecky.lockit.seed',
  'app.zecky.lockit.seedguarded',
  'app.zecky.lockit.wallet',
  'app.zecky.lockit.pin',
  'app.zecky.lockit.pinstate',
  'app.zecky.lockit.contacts',
  'app.zecky.lockit.addresses',
  'app.zecky.lockit.balance',
  'app.zecky.lockit.phrasestate',
  'app.zecky.lockit.owner',
  'app.zecky.lockit.seckeys',
  'app.zecky.lockit.seckeysheight',
  'app.zecky.lockit.sent',
  'app.zecky.lockit.servers',
] as const;

/**
 * Call once at startup, before anything reads the Keychain or starts the
 * wallet. Returns true when items from an earlier install were cleared.
 */
export async function clearIfFreshInstall(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const flag = Settings.get(KEY);
  if (flag === true || flag === 1) return false;

  // When in doubt, keep: losing a wallet is worse than keeping one. Only a
  // clear "no files" from the wallet engine, with no settings either, counts
  // as a fresh install.
  const found = SETTINGS_KEYS.filter(key => {
    const value = Settings.get(key);
    return value !== undefined && value !== null;
  });
  const hasSettings = found.length > 0;
  let noWalletFiles = false;
  let files = 'not asked';
  const native = NativeModules.RNZcash;
  if (!hasSettings && typeof native?.walletFilesExist !== 'function') {
    files = 'check unavailable';
  }
  if (!hasSettings && typeof native?.walletFilesExist === 'function') {
    try {
      const exists = await native.walletFilesExist(WALLET_ALIAS, NETWORK);
      noWalletFiles = exists === false;
      files = `exist: ${String(exists)}`;
    } catch (e) {
      noWalletFiles = false;
      files = `check failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  let cleared = false;
  const removed: string[] = [];
  const failed: string[] = [];
  if (noWalletFiles) {
    for (const service of KEYCHAIN_SERVICES) {
      try {
        if (await Keychain.resetGenericPassword({ service })) {
          cleared = true;
          removed.push(service.replace('app.zecky.lockit.', ''));
        }
      } catch {
        failed.push(service.replace('app.zecky.lockit.', ''));
      }
    }
  }
  // Diagnostics (no secrets): what this first start saw and did.
  Settings.set({
    [KEY]: true,
    [CHECK_KEY]: JSON.stringify({
      at: new Date().toISOString(),
      settings: found,
      files,
      removed,
      failed,
    }),
  });
  return cleared;
}
