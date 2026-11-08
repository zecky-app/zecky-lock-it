import { isMultiRecipient, parseScanned } from '../src/lib/paymentUri';

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

test('requests for several recipients are recognised (F4)', () => {
  expect(
    isMultiRecipient(
      `zcash:?address=${addr}&amount=1&address.1=${addr}&amount.1=2`,
    ),
  ).toBe(true);
  expect(isMultiRecipient(`zcash:${addr}?amount=1&memo.1=abc`)).toBe(true);
  expect(isMultiRecipient(`zcash:${addr}?amount=1.5&memo=abc`)).toBe(false);
  expect(isMultiRecipient(addr)).toBe(false);
});

test('Max reads the amount from the request the engine built (C-15)', () => {
  const { amountInRequest } = jest.requireActual('../src/lib/paymentUri');
  expect(amountInRequest('zcash:u1abc?amount=0.0039')).toBe('390000');
  expect(amountInRequest('zcash:?address=u1abc&amount=1.5&memo=x')).toBe(
    '150000000',
  );
  expect(amountInRequest('zcash:u1abc')).toBeNull();
  expect(
    amountInRequest('zcash:?address.1=a&amount.1=1&address.2=b&amount.2=2'),
  ).toBeNull();
  expect(amountInRequest('zcash:u1abc?amount=1.123456789')).toBeNull();
});

test('a request Zecky cannot fully honour is refused with a reason (C-20)', () => {
  const { paymentUriProblem } = jest.requireActual('../src/lib/paymentUri');
  const a = 'u1' + 'x'.repeat(40);
  expect(paymentUriProblem(`zcash:${a}?amount=1.5`)).toBeNull();
  expect(paymentUriProblem(`zcash:${a}?amount=1.5&req-futurething=1`)).toBe(
    'required',
  );
  expect(paymentUriProblem(`zcash:${a}?amount=1,5`)).toBe('amount');
  expect(paymentUriProblem(`zcash:${a}?amount=abc`)).toBe('amount');
  expect(paymentUriProblem(`zcash:${a}?amount=1&amount=2`)).toBe('duplicate');
  expect(paymentUriProblem(a)).toBeNull();
});
