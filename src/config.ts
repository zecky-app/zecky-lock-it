import type { Network } from 'react-native-zcash';

export const NETWORK: Network = 'mainnet';

// Public lightwalletd endpoint. Swap this for your own node later.
export const LIGHTWALLETD_HOST = 'zec.rocks';
export const LIGHTWALLETD_PORT = 443;

// Name of the on-device wallet database. Changing it starts a fresh sync.
export const WALLET_ALIAS = 'zecky-main';

// Sapling activation on mainnet: the earliest block a shielded wallet can
// have funds in. Used when restoring without a known wallet birthday.
export const EARLIEST_BIRTHDAY_HEIGHT = 419200;

// Fiat currencies offered in Settings. USD is the default.
export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'JPY',
] as const;
export type Currency = (typeof CURRENCIES)[number];

// Public price feed. The request carries no wallet data, but the provider
// does see the phone's IP address; choosing "None" in Settings turns it off.
export const PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=' +
  CURRENCIES.join(',').toLowerCase();
export const PRICE_REFRESH_MS = 5 * 60 * 1000;
