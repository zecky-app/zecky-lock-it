const ZATOSHI_PER_ZEC = 100_000_000n;

/**
 * Formats a zatoshi amount (as the SDK reports it: an integer string) as ZEC.
 * Shows at least `minDecimals` places and trims trailing zeros beyond that.
 */
export function formatZec(zatoshi: string, minDecimals = 2): string {
  const value = BigInt(zatoshi);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / ZATOSHI_PER_ZEC;
  let fraction = (abs % ZATOSHI_PER_ZEC).toString().padStart(8, '0');
  fraction = fraction.replace(/0+$/, '').padEnd(minDecimals, '0');
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${wholeText}${fraction ? '.' + fraction : ''}`;
}

/** Shortens an address for display: first and last `edge` characters. */
export function shortenAddress(address: string, edge = 10): string {
  if (address.length <= edge * 2 + 1) return address;
  return `${address.slice(0, edge)}…${address.slice(-edge)}`;
}

/**
 * Parses an amount typed in ZEC ("1.5" or "1,5") into zatoshi.
 * Returns null for anything that isn't a positive amount with at most
 * 8 decimal places.
 */
export function parseZec(text: string): string | null {
  const match = /^(\d*)(?:[.,](\d{0,8}))?$/.exec(text.trim());
  if (match == null) return null;
  const whole = match[1];
  const fraction = match[2] ?? '';
  if (whole === '' && fraction === '') return null;
  const zatoshi =
    BigInt(whole === '' ? '0' : whole) * ZATOSHI_PER_ZEC +
    BigInt(fraction.padEnd(8, '0'));
  return zatoshi > 0n ? zatoshi.toString() : null;
}

/** Transparent addresses are public and cannot carry a memo. */
export function isTransparentAddress(address: string): boolean {
  return /^t[13m2]/.test(address.trim());
}

export type Unit = 'ZEC' | 'zats';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The amount as shown around the app, without the unit label:
 * ZEC with exactly 3 decimals (rounded down, never overstating), or whole zats.
 * A non-zero amount too small for 3 decimals shows as "<0.001".
 */
export function formatDisplay(zatoshi: string, unit: Unit): string {
  const value = BigInt(zatoshi);
  const abs = value < 0n ? -value : value;
  const sign = value < 0n ? '-' : '';
  if (unit === 'zats') return sign + groupThousands(abs.toString());
  const thousandths = abs / 100_000n;
  if (thousandths === 0n && abs > 0n) return '<0.001';
  const whole = groupThousands((thousandths / 1000n).toString());
  const fraction = (thousandths % 1000n).toString().padStart(3, '0');
  return `${sign}${whole}.${fraction}`;
}

export function formatWithUnit(zatoshi: string, unit: Unit): string {
  return `${formatDisplay(zatoshi, unit)} ${unit}`;
}

/** Parses a whole number of zats, ignoring thousands separators and spaces. */
export function parseZats(text: string): string | null {
  const digits = text.replace(/[\s,.]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const value = BigInt(digits);
  return value > 0n ? value.toString() : null;
}

export function parseAmount(text: string, unit: Unit): string | null {
  return unit === 'ZEC' ? parseZec(text) : parseZats(text);
}

/**
 * The exact amount with its unit: ZEC with at least 3 decimals (more only
 * when needed to be exact), or whole zats. Use where precision matters.
 */
export function formatExact(zatoshi: string, unit: Unit): string {
  return unit === 'ZEC'
    ? `${formatZec(zatoshi, 3)} ZEC`
    : `${formatDisplay(zatoshi, 'zats')} zats`;
}

/** The amount as it would be typed into the amount field, in `unit`. */
export function toEditable(zatoshi: string, unit: Unit): string {
  return unit === 'ZEC' ? formatZec(zatoshi, 0).replace(/,/g, '') : zatoshi;
}

export function otherUnit(unit: Unit): Unit {
  return unit === 'ZEC' ? 'zats' : 'ZEC';
}

/**
 * Private funds that have arrived but are not usable yet: the total, minus
 * what sits on the public address, minus what can be sent right now.
 */
export function confirmingZatoshi(wallet: {
  totalZatoshi: string;
  transparentZatoshi: string;
  spendableZatoshi: string;
}): string {
  const waiting =
    BigInt(wallet.totalZatoshi) -
    BigInt(wallet.transparentZatoshi) -
    BigInt(wallet.spendableZatoshi);
  return (waiting > 0n ? waiting : 0n).toString();
}
