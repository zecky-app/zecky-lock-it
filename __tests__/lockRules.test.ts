import { needsOwner, tapLockStep } from '../src/lib/lockRules';

describe('tapping the lock', () => {
  const base = {
    lockOpen: false,
    synced: true,
    wait: 10,
    check: true,
    codeSet: false,
  };

  it('goes to Release only when the lock is already open', () => {
    expect(tapLockStep({ ...base, lockOpen: true })).toBe('release');
    expect(tapLockStep({ ...base, lockOpen: true, synced: false })).toBe(
      'release',
    );
  });

  it('never opens while not up to date or offline', () => {
    for (const wait of [10, 5, 3, 0]) {
      for (const check of [true, false]) {
        for (const codeSet of [true, false]) {
          expect(
            tapLockStep({ ...base, synced: false, wait, check, codeSet }),
          ).toBe('notReady');
        }
      }
    }
  });

  it('asks the question whenever there is a wait', () => {
    for (const wait of [10, 5, 3]) {
      for (const check of [true, false]) {
        for (const codeSet of [true, false]) {
          expect(tapLockStep({ ...base, wait, check, codeSet })).toBe('ask');
        }
      }
    }
  });

  it('without the question, still checks it is you unless that is off', () => {
    expect(tapLockStep({ ...base, wait: 0 })).toBe('deviceCheck');
    expect(tapLockStep({ ...base, wait: 0, codeSet: true })).toBe('ask');
    expect(tapLockStep({ ...base, wait: 0, check: false })).toBe('openNow');
    expect(tapLockStep({ ...base, wait: 0, check: false, codeSet: true })).toBe(
      'openNow',
    );
  });

  it('opens at once only when the question and the check are both off', () => {
    const states = [10, 5, 3, 0].flatMap(wait =>
      [true, false].flatMap(check =>
        [true, false].map(codeSet => ({ ...base, wait, check, codeSet })),
      ),
    );
    for (const s of states) {
      expect(tapLockStep(s) === 'openNow').toBe(s.wait === 0 && !s.check);
    }
  });
});

describe('changing Keys to the lock', () => {
  it('switching a check off asks first; on does not', () => {
    expect(needsOwner({ kind: 'ask', from: true, to: false })).toBe(true);
    expect(needsOwner({ kind: 'ask', from: false, to: true })).toBe(false);
    expect(needsOwner({ kind: 'ask', from: true, to: true })).toBe(false);
  });

  it('a shorter wait asks first; a longer one does not', () => {
    const waits = [10, 5, 3, 0];
    for (const from of waits) {
      for (const to of waits) {
        expect(needsOwner({ kind: 'wait', from, to })).toBe(to < from);
      }
    }
  });

  it('a new Zecky code and turning the code off always ask', () => {
    expect(needsOwner({ kind: 'newCode' })).toBe(true);
    expect(needsOwner({ kind: 'codeOff' })).toBe(true);
  });
});
