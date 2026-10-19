import { Platform } from 'react-native';
import app from '../../package.json';
import zcash from 'react-native-zcash/package.json';

const rn = Platform.constants.reactNativeVersion;

export const about = {
  appVersion: app.version,
  zcashEngine: zcash.version,
  reactNative: `${rn.major}.${rn.minor}.${rn.patch}`,
  system: `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`,
};
