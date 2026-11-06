import { Platform } from 'react-native';
import app from '../../package.json';
import zcash from 'react-native-zcash/package.json';

const rn = Platform.constants.reactNativeVersion;

/** The Zecky engine release in this build; scripts/fetch-engine.sh installs it. */
export const ENGINE_RELEASE = 'v4.0.0-zecky.2';

export const about = {
  appVersion: app.version,
  engine: `Zecky engine ${ENGINE_RELEASE.slice(1)}`,
  zcashEngine: zcash.version,
  reactNative: `${rn.major}.${rn.minor}.${rn.patch}`,
  system: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`,
};
