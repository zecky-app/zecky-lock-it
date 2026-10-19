import {
  confirmingZatoshi,
  formatDisplay,
  formatExact,
  parseAmount,
  toEditable,
  formatWithUnit,
  formatZec,
  parseZec,
  shortenAddress,
} from '../src/lib/zec';

test('formats zatoshi as ZEC', () => {
  expect(formatZec('0')).toBe('0.00');
  expect(formatZec('100000000')).toBe('1.00');
  expect(formatZec('150000000')).toBe('1.50');
  expect(formatZec('1')).toBe('0.00000001');
  expect(formatZec('123456789012')).toBe('1,234.56789012');
  expect(formatZec('-250000000')).toBe('-2.50');
  expect(formatZec('100000000', 0)).toBe('1');
});

test('shortens long addresses only', () => {
  expect(shortenAddress('abc')).toBe('abc');
  expect(shortenAddress('u1' + 'x'.repeat(40), 4)).toBe('u1xx…xxxx');
});

test('parses typed ZEC amounts into zatoshi', () => {
  expect(parseZec('1')).toBe('100000000');
  expect(parseZec('1.5')).toBe('150000000');
  expect(parseZec('1,5')).toBe('150000000');
  expect(parseZec('.25')).toBe('25000000');
  expect(parseZec(' 0.00000001 ')).toBe('1');
  expect(parseZec('21000000')).toBe('2100000000000000');
  for (const bad of [
    '',
    '.',
    '0',
    '0.0',
    '-1',
    '1.123456789',
    '1e3',
    'abc',
    '1.2.3',
  ]) {
    expect(parseZec(bad)).toBeNull();
  }
});

test('display format: 3-decimal ZEC rounded down, or zats', () => {
  expect(formatDisplay('100000000', 'ZEC')).toBe('1.000');
  expect(formatDisplay('0', 'ZEC')).toBe('0.000');
  expect(formatDisplay('123456789012', 'ZEC')).toBe('1,234.567');
  expect(formatDisplay('199999999', 'ZEC')).toBe('1.999');
  expect(formatDisplay('99999', 'ZEC')).toBe('<0.001');
  expect(formatDisplay('100000000', 'zats')).toBe('100,000,000');
  expect(formatDisplay('0', 'zats')).toBe('0');
  expect(formatWithUnit('250000000', 'ZEC')).toBe('2.500 ZEC');
  expect(formatWithUnit('1234', 'zats')).toBe('1,234 zats');
});

test('amounts in either unit: parse, exact display, editable form', () => {
  expect(parseAmount('0.001', 'ZEC')).toBe('100000');
  expect(parseAmount('100,000', 'zats')).toBe('100000');
  expect(parseAmount('100 000', 'zats')).toBe('100000');
  expect(parseAmount('0', 'zats')).toBeNull();
  expect(parseAmount('12a', 'zats')).toBeNull();
  expect(formatExact('100000', 'ZEC')).toBe('0.001 ZEC');
  expect(formatExact('10000', 'ZEC')).toBe('0.0001 ZEC');
  expect(formatExact('100000000', 'ZEC')).toBe('1.000 ZEC');
  expect(formatExact('100000', 'zats')).toBe('100,000 zats');
  expect(toEditable('123456789012', 'ZEC')).toBe('1234.56789012');
  expect(toEditable('100000', 'ZEC')).toBe('0.001');
  expect(toEditable('100000', 'zats')).toBe('100000');
});

test('confirming amount: private funds not usable yet', () => {
  const w = (total: string, transparent: string, spendable: string) =>
    confirmingZatoshi({
      totalZatoshi: total,
      transparentZatoshi: transparent,
      spendableZatoshi: spendable,
    });
  expect(w('500000', '0', '500000')).toBe('0');
  expect(w('800000', '0', '500000')).toBe('300000');
  // Funds on the public address are not "confirming"; they need shielding.
  expect(w('800000', '300000', '500000')).toBe('0');
  expect(w('100', '0', '500')).toBe('0');
});
