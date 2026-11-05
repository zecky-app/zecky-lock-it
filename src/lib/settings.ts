import { Platform, Settings } from 'react-native';
import { CURRENCIES, Currency } from '../config';
import type { Unit } from './zec';

const UNIT_KEY = 'zecky.unit';

// React Native's built-in Settings store only exists on iOS. On other
// platforms the choice simply lasts until the app is closed.
export function loadUnit(): Unit {
  if (Platform.OS !== 'ios') return 'ZEC';
  return Settings.get(UNIT_KEY) === 'zats' ? 'zats' : 'ZEC';
}

export function saveUnit(unit: Unit): void {
  if (Platform.OS === 'ios') Settings.set({ [UNIT_KEY]: unit });
}

const HIDDEN_KEY = 'zecky.hideAmounts';

export function loadHidden(): boolean {
  if (Platform.OS !== 'ios') return false;
  const stored = Settings.get(HIDDEN_KEY);
  return stored === true || stored === 1;
}

export function saveHidden(hidden: boolean): void {
  if (Platform.OS === 'ios') Settings.set({ [HIDDEN_KEY]: hidden });
}

const CURRENCY_KEY = 'zecky.currency';

/**
 * The chosen fiat currency, or null for none. Self-audit N3: until the
 * person chooses, there is no currency and so no request to a price
 * service; Home offers the choice once.
 */
export function loadCurrency(): Currency | null {
  if (Platform.OS !== 'ios') return null;
  const stored = Settings.get(CURRENCY_KEY);
  return (CURRENCIES as readonly string[]).includes(stored)
    ? (stored as Currency)
    : null;
}

/** Whether a currency (or None) was ever chosen on this install. */
export function isCurrencyChosen(): boolean {
  if (Platform.OS !== 'ios') return true;
  const stored = Settings.get(CURRENCY_KEY);
  return typeof stored === 'string' && stored !== '';
}

export function saveCurrency(currency: Currency | null): void {
  if (Platform.OS === 'ios') {
    Settings.set({ [CURRENCY_KEY]: currency ?? 'none' });
  }
}

/** Unit, hidden amounts and currency back to their defaults, for Erase wallet. */
export function resetDisplaySettings(): void {
  if (Platform.OS !== 'ios') return;
  try {
    Settings.set({
      [UNIT_KEY]: 'ZEC',
      [HIDDEN_KEY]: false,
      [CURRENCY_KEY]: null,
    });
  } catch {
    // The screens read these again when a wallet opens.
  }
}
