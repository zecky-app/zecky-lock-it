// Audit C-43: unknown engine errors get a plain first sentence, while the
// app's own messages pass through unchanged.
import * as errors from '../src/lib/errors';

test("the app's own messages are never rewritten", () => {
  const own = Object.entries(errors).filter(
    ([, v]) => typeof v === 'string',
  ) as [string, string][];
  expect(own.length).toBeGreaterThan(5);
  for (const [, text] of own) {
    expect(errors.friendlyError(text)).toBe(text);
  }
});

test('technical engine text gets a plain lead and a short detail', () => {
  const raw =
    'ZcashError.rustProposeTransferFromURI("Error: zcash_client_backend::data_api::error { code: 12 }")';
  const text = errors.friendlyError(raw);
  expect(text).toMatch(/^Something went wrong inside the Zcash engine\./);
  expect(text.length).toBeLessThan(330);
});

test('a failed spend keeps the engine reason and still says to check Activity', () => {
  const text = errors.friendlyError(
    'Failed to spend: Error while building transaction: missing params',
  );
  expect(text).toMatch(/Check Activity/);
  expect(text).not.toMatch(/nothing was sent/i);
  expect(text).toContain('missing params');
});
