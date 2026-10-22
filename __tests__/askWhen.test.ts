import { asksAt, resetAskWhen, setAskAt } from '../src/lib/askWhen';

describe('asksAt', () => {
  beforeEach(() => resetAskWhen());

  it('asks at start only with a Zecky code, until chosen', () => {
    expect(asksAt('start', true)).toBe(true);
    expect(asksAt('start', false)).toBe(false);
    setAskAt('start', true);
    expect(asksAt('start', false)).toBe(true);
    setAskAt('start', false);
    expect(asksAt('start', true)).toBe(false);
  });

  it('asks when opening the lock unless switched off', () => {
    expect(asksAt('openLock', false)).toBe(true);
    setAskAt('openLock', false);
    expect(asksAt('openLock', true)).toBe(false);
  });
});
