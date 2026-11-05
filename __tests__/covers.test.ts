// Self-audit K2 and re-check R9: the capture and app-switcher covers sit in
// their own window above every sheet, modal for VoiceOver.
export {};

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
}>('fs');

test('covers are windows above everything, modal for VoiceOver', () => {
  const text = fs.readFileSync('ios/Zecky/AppDelegate.swift', 'utf8');
  expect(text).toContain('cover.windowLevel = .alert + 1');
  expect(text).toContain('view.accessibilityViewIsModal = true');
  expect(text).toContain('UIScreen.capturedDidChangeNotification');
  expect(text).toContain('privacyWindow = coverWindow(caption: nil)');
  expect(text).not.toContain('window.addSubview(');
});
