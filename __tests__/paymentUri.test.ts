import { parseScanned } from '../src/lib/paymentUri';

const addr = 'u1' + 'q'.repeat(60);

test('reads bare addresses and zcash: payment requests', () => {
  expect(parseScanned(addr)).toEqual({ address: addr });
  expect(parseScanned(` ${addr}\n`)).toEqual({ address: addr });
  expect(parseScanned(`zcash:${addr}`)).toEqual({ address: addr });
  expect(parseScanned(`zcash:${addr}?amount=1.5&memo=abc`)).toEqual({
    address: addr,
    zatoshi: '150000000',
  });
  expect(parseScanned(`ZCASH:?address=${addr}&amount=0.001`)).toEqual({
    address: addr,
    zatoshi: '100000',
  });
});

test('rejects things that are not Zcash codes', () => {
  expect(parseScanned('')).toBeNull();
  expect(parseScanned('https://example.com/pay')).toBeNull();
  expect(parseScanned('hello world')).toBeNull();
  expect(parseScanned('zcash:short')).toBeNull();
  expect(parseScanned(`zcash:${addr}?amount=abc`)).toEqual({ address: addr });
});
