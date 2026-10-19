// Notes on a payment can be written by anyone, including scammers who send
// a tiny amount with "claim your reward at ...". Notes are shown as plain
// text; this spots the ones that carry a web address so a warning can sit
// next to them.
const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|app|xyz|me|info|cash|finance|link|site|online|top|ru|cn)\b)/i;

export function hasLink(memo: string): boolean {
  return LINK.test(memo);
}
