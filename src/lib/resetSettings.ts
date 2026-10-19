import { clearSent } from './sentLog';
import { resetServers } from './server';
import { resetDisplaySettings } from './settings';
import { resetTor } from './tor';
import { resetThemeMode } from '../theme';

/**
 * Puts every setting back to how a fresh install starts: servers (including
 * a Rock it home node), Tor, theme, unit, hidden amounts and currency.
 *
 * Call only after the wallet screen has closed: changing the server or Tor
 * while a wallet is running restarts it.
 */
export function resetAllSettings(): void {
  resetServers();
  resetTor();
  resetThemeMode();
  resetDisplaySettings();
  clearSent();
}
