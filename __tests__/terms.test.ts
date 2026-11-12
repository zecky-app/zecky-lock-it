// "Before you start": accepted once, remembered with its version, shown
// again only when the terms version is raised.
const mockSettings: Record<string, unknown> = {};
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: (key: string) => mockSettings[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mockSettings, values),
  },
}));

beforeEach(() => {
  for (const key of Object.keys(mockSettings)) delete mockSettings[key];
  jest.resetModules();
});

const load = () =>
  require('../src/lib/terms') as typeof import('../src/lib/terms');

test('not accepted on a fresh install', () => {
  expect(load().termsAccepted()).toBe(false);
});

test('accepting keeps the version and the day, nothing else', () => {
  const terms = load();
  terms.acceptTerms(new Date('2026-11-12T08:00:00Z'));
  expect(terms.termsAccepted()).toBe(true);
  expect(JSON.parse(mockSettings['zecky.terms.accepted'] as string)).toEqual({
    version: terms.TERMS_VERSION,
    on: '2026-11-12',
  });
});

test('remembered at the next start', () => {
  load().acceptTerms();
  expect(load().termsAccepted()).toBe(true);
});

test('shown again when the terms version is newer than the accepted one', () => {
  mockSettings['zecky.terms.accepted'] = JSON.stringify({
    version: load().TERMS_VERSION - 1,
    on: '2026-01-01',
  });
  expect(load().termsAccepted()).toBe(false);
});

test('an unreadable value shows the screen again', () => {
  mockSettings['zecky.terms.accepted'] = 'not json';
  expect(load().termsAccepted()).toBe(false);
});
