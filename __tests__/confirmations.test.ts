import type { Transaction } from 'react-native-zcash';
import { slowestWaiting, waitingText } from '../src/lib/confirmations';

function tx(minedHeight: number, toAddress?: string): Transaction {
  return {
    rawTransactionId: `t${minedHeight}${toAddress ?? ''}`,
    blockTimeInSeconds: 1,
    minedHeight,
    value: '100000',
    toAddress,
    isShielding: false,
    isExpired: false,
    memos: [],
  };
}

describe('waiting for confirmations', () => {
  it('counts down for received Zcash: 10 confirmations', () => {
    const w = slowestWaiting([tx(100)], 103); // 4 confirmations
    expect(w).toEqual({ confirmations: 4, needed: 10, minutes: 8 });
    expect(waitingText(w)).toBe(
      'usable in about 8 minutes · 4/10 confirmations',
    );
  });

  it('own change needs 3', () => {
    const w = slowestWaiting([tx(100, 'zs1someone')], 101);
    expect(w).toEqual({ confirmations: 2, needed: 3, minutes: 1 });
  });

  it('not in a block yet: waiting for a block', () => {
    const w = slowestWaiting([tx(0)], 500);
    expect(w).toEqual({ confirmations: 0, needed: 10, minutes: 13 });
    expect(waitingText(w)).toBe(
      'usable in about 13 minutes · waiting for a block',
    );
  });

  it('shows the payment that is usable last', () => {
    const w = slowestWaiting([tx(100), tx(105)], 106);
    expect(w?.confirmations).toBe(2);
  });

  it('nothing left once confirmed, and the last minute reads well', () => {
    expect(slowestWaiting([tx(100)], 109)).toBeNull();
    expect(waitingText(slowestWaiting([tx(100)], 108))).toBe(
      'usable in about a minute · 9/10 confirmations',
    );
  });

  it('without the latest block it falls back to the plain estimate', () => {
    expect(slowestWaiting([tx(100)], 0)).toBeNull();
    expect(waitingText(null)).toBe('usable within about 12 minutes');
  });
});
