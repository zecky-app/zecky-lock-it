// The first-run tour: shown once, remembered, shown again on request and
// after Erase wallet.
const mockSettings: Record<string, unknown> = {};
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Settings: {
    get: (key: string) => mockSettings[key],
    set: (values: Record<string, unknown>) =>
      Object.assign(mockSettings, values),
  },
}));

import { finishTour, resetTour, showTour, tourSeen } from '../src/lib/tour';

test('not seen at first; finishing remembers it', () => {
  expect(tourSeen()).toBe(false);
  showTour();
  finishTour();
  expect(tourSeen()).toBe(true);
  expect(mockSettings['zecky.tour.seen']).toBe(true);
});

test('Erase wallet shows it once more for the next wallet', () => {
  resetTour();
  expect(tourSeen()).toBe(false);
  expect(mockSettings['zecky.tour.seen']).toBeNull();
});
