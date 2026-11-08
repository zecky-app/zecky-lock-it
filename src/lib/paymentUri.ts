import { formatZec, parseZec } from './zec';

export interface ScannedPayment {
  address: string;
  /** Present when the code asked for a specific amount. */
  zatoshi?: string;
}

/**
 * Reads what a Zcash QR code contains: either a bare address or a
 * "zcash:<address>?amount=1.5" payment request (ZIP 321, single recipient).
 * Returns null for anything that doesn't look like either.
 */
export function parseScanned(text: string): ScannedPayment | null {
  const trimmed = text.trim();
  if (trimmed === '' || /\s/.test(trimmed)) return null;

  if (!/^zcash:/i.test(trimmed)) {
    return /^[a-zA-Z0-9]{20,}$/.test(trimmed) ? { address: trimmed } : null;
  }

  const [addressPart, query = ''] = trimmed.slice('zcash:'.length).split('?');
  let address = addressPart;
  let zatoshi: string | undefined;
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key === 'address' && address === '') address = value;
    if (key === 'amount')
      zatoshi = parseZec(value.replace(',', 'x')) ?? undefined;
  }
  if (!/^[a-zA-Z0-9]{20,}$/.test(address)) return null;
  return zatoshi == null ? { address } : { address, zatoshi };
}

/**
 * Audit C-20: what is wrong with a ZIP 321 request, if anything, so it is
 * refused with a reason instead of half-read. ZIP 321 says a wallet must not
 * pay a request with a `req-` parameter it does not understand, and an
 * amount that cannot be read must not be dropped silently.
 */
export function paymentUriProblem(
  text: string,
): 'required' | 'amount' | 'duplicate' | null {
  const trimmed = text.trim();
  if (!/^zcash:/i.test(trimmed)) return null;
  const query = trimmed.split('?')[1] ?? '';
  const seen = new Set<string>();
  for (const pair of query.split('&')) {
    if (pair === '') continue;
    const [rawKey, value = ''] = pair.split('=');
    const key = rawKey.toLowerCase();
    if (key.startsWith('req-')) return 'required';
    if (seen.has(key)) return 'duplicate';
    seen.add(key);
    if (key === 'amount' && parseZec(value.replace(',', 'x')) == null) {
      return 'amount';
    }
  }
  return null;
}

/**
 * Self-audit F4: a ZIP 321 request can name several recipients (address.1,
 * amount.1 …). Zecky pays one recipient at a time, so such a request is
 * refused instead of silently paying only the first.
 */
export function isMultiRecipient(text: string): boolean {
  const trimmed = text.trim();
  if (!/^zcash:/i.test(trimmed)) return false;
  const query = trimmed.split('?')[1] ?? '';
  return query
    .split('&')
    .some(pair => /^[a-z]+\.\d+$/i.test(pair.split('=')[0]));
}

/** A "zcash:" payment request for `address`, optionally for a set amount. */
export function buildPaymentUri(address: string, zatoshi?: string): string {
  if (zatoshi == null) return `zcash:${address}`;
  const amount = formatZec(zatoshi, 0).replace(/,/g, '');
  return `zcash:${address}?amount=${amount}`;
}

/**
 * Audit C-15: the amount of a one-recipient ZIP 321 request the engine built
 * (for Max), in zatoshi; null when it is missing or there is more than one.
 */
export function amountInRequest(uri: string): string | null {
  const query = uri.split('?')[1] ?? '';
  const amounts = query
    .split('&')
    .map(part => part.split('='))
    .filter(([key]) => key === 'amount' || key.startsWith('amount.'));
  if (amounts.length !== 1) return null;
  const value = decodeURIComponent(amounts[0][1] ?? '');
  if (!/^\d+(\.\d{1,8})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const zatoshi =
    BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, '0'));
  return zatoshi > 0n ? zatoshi.toString() : null;
}
