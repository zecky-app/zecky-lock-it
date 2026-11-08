import { Platform } from 'react-native';
import app from '../../package.json';
import zcash from 'react-native-zcash/package.json';

const rn = Platform.constants.reactNativeVersion;

/**
 * The build number (CFBundleVersion), kept equal to CURRENT_PROJECT_VERSION
 * in the Xcode project by __tests__/version.test.ts (audit G2: without it,
 * builds of one version could not be told apart on the phone).
 */
export const APP_BUILD = 23;

/** The Zecky engine release in this build; scripts/fetch-engine.sh installs it. */
export const ENGINE_RELEASE = 'v4.0.0-zecky.3';

export const about = {
  appVersion: `${app.version} (${APP_BUILD})`,
  engine: `Zecky engine ${ENGINE_RELEASE.slice(1)}`,
  zcashEngine: zcash.version,
  reactNative: `${rn.major}.${rn.minor}.${rn.patch}`,
  system: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`,
};
