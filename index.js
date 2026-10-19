/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Note: the 'react-native-get-random-values' polyfill is deliberately NOT
// imported. Zecky takes its randomness straight from the native secure
// generator (src/wallet/nativeRandom.ts). Without the polyfill, any code
// that reaches for crypto.getRandomValues fails loudly instead of risking
// the polyfill's weak debugging fallback.
