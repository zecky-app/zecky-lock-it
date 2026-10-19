import {
  fiatEditable,
  fiatToZatoshi,
  formatFiat,
  parsePrices,
} from '../src/lib/price';

test('reads the price feed', () => {
  expect(parsePrices({ zcash: { usd: 41.2, eur: 38 } })).toEqual({
    USD: 41.2,
    EUR: 38,
  });
  expect(parsePrices({ zcash: { usd: 'x', eur: 0 } })).toBeNull();
  expect(parsePrices({})).toBeNull();
  expect(parsePrices(null)).toBeNull();
});

test('formats fiat values US-style', () => {
  expect(formatFiat('100000000', 41.2, 'USD')).toBe('$41.20');
  expect(formatFiat('250000000', 1000, 'USD')).toBe('$2,500.00');
  expect(formatFiat('100000', 40, 'USD')).toBe('$0.04');
  expect(formatFiat('100000000', 38.1, 'EUR')).toBe('€38.10');
  expect(formatFiat('100000000', 6200, 'JPY')).toBe('¥6,200');
  expect(formatFiat('0', 41.2, 'USD')).toBe('$0.00');
});

test('converts typed fiat to zatoshi and back', () => {
  expect(fiatToZatoshi('40', 40)).toBe('100000000');
  expect(fiatToZatoshi('5.50', 55)).toBe('10000000');
  expect(fiatToZatoshi('5,50', 55)).toBe('10000000');
  expect(fiatToZatoshi('.5', 50)).toBe('1000000');
  for (const bad of ['', '0', '0.00', 'abc', '1.234', '-1']) {
    expect(fiatToZatoshi(bad, 40)).toBeNull();
  }
  expect(fiatToZatoshi('5', 0)).toBeNull();
  expect(fiatEditable('10000000', 55)).toBe('5.50');
});
