/** Shown while syncing when the connection to the server broke off. */
export const SYNC_DROPPED =
  'The connection to the Zcash server dropped for a moment. Zecky is trying again by itself.';
/** The same, when it keeps happening for a few minutes. */
export const SYNC_DROPPED_LONG =
  'Zecky keeps losing the connection to the Zcash server. It keeps trying; you can also choose another server under Settings › Network.';

// Turns the Zcash engine's technical error text into a sentence that says
// what happened and what to do. Unknown errors pass through unchanged.
const RULES: [RegExp, string][] = [
  [
    // A block download or server call that broke off while syncing, such as
    // "LightWalletService.blockStream failed." (first tester, Nov 4). The
    // engine retries by itself.
    /blockStream|LightWalletService\.\w+ failed|stream (failed|closed|reset)/i,
    SYNC_DROPPED,
  ],
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

export const SERVER_CHANGED_SEND =
  'The server changed while you were tapping your key. Nothing was released. Try again.';
export const NU7_PAUSED =
  'Releasing is paused for the Zcash network upgrade (NU7) until Zecky is updated. Your Zcash is safe, and you can still receive.';
export const TOR_NOT_READY =
  'Tor is not connected yet, so nothing was released. Wait until Tor is on, or switch Tor off under Settings › Network.';
export const OFFLINE_SEND = 'No internet connection. Nothing was released.';
export const SEND_PENDING =
  'It could not be delivered to the Zcash network yet. Zecky keeps trying by itself every few minutes. Do not release it again.';
export const SEND_REJECTED =
  'The network has not accepted this release yet. Zecky keeps trying for about 50 minutes. If it is still not accepted, it is cancelled and nothing leaves the lock. Do not release it again.';

/** An error for a payment that was created and will still go out by itself. */
export function paymentSavedError(
  message: string,
  detail?: string | null,
): Error {
  return Object.assign(new Error(message), {
    paymentSaved: true,
    detail: detail ?? null,
  });
}

/** The engine's reason attached to a saved payment, if any. */
export function savedDetail(e: unknown): string | null {
  const detail = (e as { detail?: unknown } | null)?.detail;
  return typeof detail === 'string' && detail !== '' ? detail : null;
}

export function isPaymentSaved(e: unknown): boolean {
  return (e as { paymentSaved?: boolean } | null)?.paymentSaved === true;
}

export const HOME_NODE_SEND =
  'Rock it cannot be reached on this connection. Use your home Wi-Fi or turn on Tailscale, or pick another server under Network. Nothing was released.';
