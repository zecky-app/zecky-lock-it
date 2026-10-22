// Turns the Zcash engine's technical error text into a sentence that says
// what happened and what to do. Unknown errors pass through unchanged.
const RULES: [RegExp, string][] = [
  [
    /belongs to another wallet/i,
    'This device still holds data from an earlier wallet. Delete the Zecky app, install it again, and your wallet will open cleanly.',
  ],
  [
    /not synced|still starting/i,
    'The wallet is still syncing. Try again once it is up to date.',
  ],
  [
    /insufficient|not enough|InsufficientFunds|balance/i,
    'Not enough available funds for this amount plus the network fee. Funds you received recently need a few confirmations first.',
  ],
  [
    /memo.*(long|large|size)|(long|large|size).*memo/i,
    'The private note is too long. Shorten it and try again.',
  ],
  [
    /shield/i,
    'Shielding did not go through. The amount may be too small to cover the network fee, or still confirming.',
  ],
  [
    /grpc|unavailable|timed? ?out|timeout|offline|network|connection|connect|dns|unreachable|tls|ssl/i,
    'Cannot reach the Zcash network. Check your internet connection and try again.',
  ],
  [
    /already in use|alias|failed to initialize/i,
    'The wallet could not start. Close Zecky completely and open it again.',
  ],
  [
    /failed to spend|submit|not attempted|rejected/i,
    'The payment could not be completed. Check Activity before trying again: if it is listed there, it will still be sent.',
  ],
];

export function friendlyError(message: string): string {
  for (const [pattern, text] of RULES) {
    if (pattern.test(message)) return text;
  }
  return message;
}

export function describeError(e: unknown): string {
  return friendlyError(e instanceof Error ? e.message : String(e));
}

export const OFFLINE_SEND = 'No internet connection. Nothing was released.';
export const SEND_PENDING =
  'No connection to the Zcash network right now. Your release is saved and goes out by itself as soon as the connection is back. Do not release it again.';
export const SEND_REJECTED =
  'The network has not accepted this release yet. Zecky keeps trying for about 50 minutes. If it is still not accepted, it is cancelled and nothing leaves the lock. Do not release it again.';

/** An error for a payment that was created and will still go out by itself. */
export function paymentSavedError(message: string): Error {
  return Object.assign(new Error(message), { paymentSaved: true });
}

export function isPaymentSaved(e: unknown): boolean {
  return (e as { paymentSaved?: boolean } | null)?.paymentSaved === true;
}

export const HOME_NODE_SEND =
  'Rock it cannot be reached on this connection. Use your home Wi-Fi or turn on Tailscale, or pick another server under Network. Nothing was released.';
