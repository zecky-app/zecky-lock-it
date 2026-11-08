// Notes on a payment can be written by anyone, including scammers who send
// a tiny amount with "claim your reward at ...". Notes are shown as plain
// text; this spots the ones that carry a web address so a warning can sit
// next to them.
const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|app|xyz|me|info|cash|finance|link|site|online|top|ru|cn)\b)/i;

export function hasLink(memo: string): boolean {
  return LINK.test(memo);
}

/** A Zcash note holds at most 512 bytes of UTF-8 (ZIP 302). */
export const MEMO_MAX_BYTES = 512;

function bytesOf(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/** The note's size in UTF-8 bytes, as the engine counts it. */
export function memoBytes(text: string): number {
  let total = 0;
  for (const char of text) total += bytesOf(char.codePointAt(0) ?? 0);
  return total;
}

/**
 * The note cut to what fits, at a whole character (audit C-18: the field
 * counted characters, so 500 emoji passed and the engine refused them).
 */
export function fitMemo(text: string): string {
  let total = 0;
  let out = '';
  for (const char of text) {
    total += bytesOf(char.codePointAt(0) ?? 0);
    if (total > MEMO_MAX_BYTES) break;
    out += char;
  }
  return out;
}
