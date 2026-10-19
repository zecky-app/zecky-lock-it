import { useEffect, useState } from 'react';
import { NativeModules } from 'react-native';
import { Currency, PRICE_REFRESH_MS, PRICE_URL, WALLET_ALIAS } from '../config';

/** Price of 1 ZEC per currency code, e.g. { USD: 41.2, EUR: 38.1 }. */
export type Prices = Partial<Record<Currency, number>>;

let cached: { source: string; prices: Prices } | null = null;

export function parsePrices(json: unknown): Prices | null {
  const row = (json as { zcash?: Record<string, unknown> } | null)?.zcash;
  if (row == null || typeof row !== 'object') return null;
  const prices: Prices = {};
  for (const [code, value] of Object.entries(row)) {
    if (typeof value === 'number' && value > 0) {
      prices[code.toUpperCase() as Currency] = value;
    }
  }
  return Object.keys(prices).length > 0 ? prices : null;
}

/**
 * Where prices come from:
 *  - 'direct': the public price feed, which sees the phone's IP address
 *  - 'tor':    the Zcash engine, over Tor. USD only.
 *  - 'none':   nowhere. Used while Tor is wanted but not connected, so the
 *              app never falls back to a direct request behind your back.
 */
export type PriceSource = 'direct' | 'tor' | 'none';

async function fetchDirect(): Promise<Prices | null> {
  const response = await fetch(PRICE_URL);
  if (!response.ok) return null;
  return parsePrices(await response.json());
}

async function fetchOverTor(): Promise<Prices | null> {
  // Added to the Zcash library by patches/react-native-zcash+*.patch.
  const native = NativeModules.RNZcash;
  if (typeof native?.usdRate !== 'function') return null;
  const rate = await native.usdRate(WALLET_ALIAS);
  return typeof rate === 'number' && rate > 0 ? { USD: rate } : null;
}

/**
 * Fetches ZEC prices while `enabled`, refreshing every few minutes. Returns
 * the last known prices for that source, or null before the first answer.
 * Never throws: without a price the app just leaves the fiat line out.
 */
export function usePrices(
  enabled: boolean,
  source: PriceSource = 'direct',
): Prices | null {
  const [prices, setPrices] = useState<Prices | null>(
    cached?.source === source ? cached.prices : null,
  );

  useEffect(() => {
    setPrices(cached?.source === source ? cached.prices : null);
    if (!enabled || source === 'none') return;
    let cancelled = false;
    const load = async () => {
      try {
        const parsed =
          source === 'tor' ? await fetchOverTor() : await fetchDirect();
        if (parsed != null && !cancelled) {
          cached = { source, prices: parsed };
          setPrices(parsed);
        }
      } catch {
        // Offline, blocked or Tor too slow: keep whatever we had.
      }
    };
    load();
    const timer = setInterval(load, PRICE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, source]);

  return prices;
}

/** "$41.20", "€38.10", "¥6,200": the value of `zatoshi` at `price` per ZEC. */
export function formatFiat(
  zatoshi: string,
  price: number,
  currency: Currency,
): string {
  const value = (Number(zatoshi) / 1e8) * price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Converts a typed fiat amount ("5", "5.50" or "5,50") into zatoshi at
 * `price` per ZEC. Returns null for anything that isn't a positive amount.
 */
export function fiatToZatoshi(text: string, price: number): string | null {
  const match = /^(\d*)(?:[.,](\d{0,2}))?$/.exec(text.trim());
  if (match == null || !(price > 0)) return null;
  const value = Number(`${match[1] || '0'}.${match[2] || '0'}`);
  if (!(value > 0)) return null;
  const zatoshi = BigInt(Math.round((value / price) * 1e8));
  return zatoshi > 0n ? zatoshi.toString() : null;
}

/** A zatoshi amount as plain fiat digits for the amount field, e.g. "5.50". */
export function fiatEditable(zatoshi: string, price: number): string {
  return ((Number(zatoshi) / 1e8) * price).toFixed(2);
}
