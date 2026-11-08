/** Shown while syncing when the connection to the server broke off. */
export const SYNC_DROPPED =
  'The connection to the Zcash server dropped for a moment. Zecky is trying again by itself.';
/** The same, when it keeps happening for a few minutes. */
export const SYNC_DROPPED_LONG =
  'Zecky keeps losing the connection to the Zcash server. It keeps trying; you can also choose another server under Settings › Network.';

// Turns the Zcash engine's technical error text into a sentence that says
// what happened and what to do. Unknown errors pass through unchanged.
const GENERAL_SEND_FAILURE = /failed to spend|submit|not attempted|rejected/i;

const RULES: [RegExp, string][] = [
  [
    // A block download or server call that broke off while syncing, such as
    // "LightWalletService.blockStream failed." (first tester, Nov 4). The
    // engine retries by itself.
    /blockStream|LightWalletService\.\w+ failed|stream (failed|closed|reset)/i,
    SYNC_DROPPED,
  ],
  [
    // Never "delete the app": deleting Zecky removes the phrase from the
    // Keychain on the next install (audit C-37).
    /belongs to another wallet/i,
    'This iPhone still holds wallet data from another recovery phrase. Make sure you have your 24 words on paper, then use Settings › Security › Erase wallet and restore from them. Do not delete the app first.',
  ],
  [
    // Engine (ZIP 316 revision 2): the recipient's address has an expiry
    // date that has passed.
    /recipient address has expired/i,
    'This address has expired. Ask the recipient for a new address. Nothing was sent.',
  ],
  [
    // Engine: a unified address that only accepts a kind of payment Zecky
    // cannot make yet.
    /exposes no receiver this wallet can pay/i,
    'Zecky cannot pay this address yet: it only accepts a kind of payment Zecky does not support. Ask the recipient for another address. Nothing was sent.',
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
    GENERAL_SEND_FAILURE,
    'The payment could not be completed. Check Activity before trying again: if it is listed there, it will still be sent.',
  ],
];

/** Engine, database or network internals rather than a sentence for people. */
const TECHNICAL =
  /::|[{}]|\b[a-z]+_[a-z_]+\b|0x[0-9a-f]{4,}|\b(rust|ffi|sqlite|grpc|tonic|nserror|errsec|panicked|unwrap|zcasherror)\b|error domain|status code/i;

/**
 * The app's own messages, passed through as written: the rules above are
 * for engine text and could otherwise rewrite them (HOME_NODE_SEND was
 * shown as "Cannot reach the Zcash network"). errorTexts.test.ts fails when
 * a new exported message is missing here.
 */
function ownMessages(): Set<string> {
  return new Set([
    SYNC_DROPPED,
    SYNC_DROPPED_LONG,
    SERVER_CHANGED_SEND,
    SEED_NOT_RELEASED,
    SEED_NOT_RELEASED_LOCK_IN,
    ALREADY_RELEASING,
    LOCK_NOT_OPEN,
    SEED_MISSING,
    SEED_MISSING_LOCK_IN,
    NU7_PAUSED,
    TOR_NOT_READY,
    OFFLINE_SEND,
    SEND_PENDING,
    SEND_REJECTED,
    HOME_NODE_SEND,
  ]);
}

export function friendlyError(message: string): string {
  if (ownMessages().has(message)) return message;
  for (const [pattern, text] of RULES) {
    if (!pattern.test(message)) continue;
    // The general "could not be completed" rule keeps the engine's own
    // reason, so a failure can be traced. "Failed to spend" also covers
    // errors after the payment was built, so it never says nothing was sent.
    if (pattern === GENERAL_SEND_FAILURE) {
      const detail = /^Failed to spend:\s*([\s\S]+)/i
        .exec(message.trim())?.[1]
        ?.trim();
      if (detail) {
        const short =
          detail.length > 200 ? `${detail.slice(0, 197).trimEnd()}…` : detail;
        return `${text} Detail: ${short}`;
      }
    }
    return text;
  }
  // Audit C-43: an unknown engine error gets a plain first sentence; the
  // detail stays visible (nothing hidden), shortened.
  if (TECHNICAL.test(message)) {
    const detail =
      message.length > 160 ? `${message.slice(0, 157).trimEnd()}…` : message;
    return `Something went wrong inside the Zcash engine. Nothing was changed by this message; try again in a moment. Detail: ${detail}`;
  }
  return message;
}

export function describeError(e: unknown): string {
  return friendlyError(e instanceof Error ? e.message : String(e));
}

export const SERVER_CHANGED_SEND =
  'The server changed while you were tapping your key. Nothing was sent. Try again.';
export const SEED_NOT_RELEASED =
  'Face ID or the passcode was cancelled, so nothing was sent.';
export const SEED_NOT_RELEASED_LOCK_IN =
  'Face ID or the passcode was cancelled, so nothing was locked in.';
/** Audit C-23: a second release or lock-in while one is running. */
export const ALREADY_RELEASING =
  'One moment: Zecky is still finishing the last one.';
/** Audit C-09: a release asked for while the lock is closed. */
export const LOCK_NOT_OPEN =
  'The lock closed before the payment went out, so nothing was sent. Open the lock and try again.';
/** Audit C-01: iOS removes the guarded phrase when the passcode is turned off. */
export const SEED_MISSING =
  'The recovery phrase is no longer on this iPhone, so nothing was sent. iOS removes it when the iPhone passcode is turned off. Your Zcash is safe: restore from your 24 words.';
export const SEED_MISSING_LOCK_IN =
  'The recovery phrase is no longer on this iPhone, so nothing was locked in. iOS removes it when the iPhone passcode is turned off. Your Zcash is safe: restore from your 24 words.';
export const NU7_PAUSED =
  'Sending is paused for the Zcash network upgrade (NU7) until Zecky is updated. Your Zcash is safe, and you can still receive.';
export const TOR_NOT_READY =
  'Tor is not connected yet, so nothing was sent. Wait until Tor is on, or switch Tor off under Settings › Network.';
export const OFFLINE_SEND = 'No internet connection. Nothing was sent.';
export const SEND_PENDING =
  'It could not be delivered to the Zcash network yet. Zecky keeps trying by itself every few minutes while it is open. Keep Zecky open until Activity shows it sent, and do not send it again.';
export const SEND_REJECTED =
  'The network has not accepted this payment yet. Zecky keeps trying for about 50 minutes. If it is still not accepted, it is cancelled and nothing leaves the lock. Do not send it again.';

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
  'Rock it cannot be reached on this connection. Use your home Wi-Fi or turn on Tailscale, or pick another server under Network. Nothing was sent.';
