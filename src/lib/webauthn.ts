/* eslint-disable no-bitwise */
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

// The checks Zecky does on a security key's answers (FIDO2 / WebAuthn).
// Plain functions without React Native, so they are covered by tests. The
// signature itself is checked natively with Apple's CryptoKit.

/** The name the keys are registered under. Must match apple-app-site-association. */
export const RP_ID = 'zecky.app';

const FLAG_USER_PRESENT = 0x01;
const FLAG_ATTESTED = 0x40;

export class SecurityKeyDataError extends Error {}

function fail(why: string): never {
  throw new SecurityKeyDataError(why);
}

// --- Base64 ---

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n =
      (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '=';
  }
  return out;
}

/** Accepts standard and URL-safe base64, with or without padding. */
export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/-/g, '+').replace(/_/g, '/').replace(/[=]+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) fail('Invalid base64');
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]+$/, '');
}

function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) cp = b;
    else if (b >> 5 === 0x6) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b >> 4 === 0xe)
      cp =
        ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else
      cp =
        ((b & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// --- A small CBOR reader: just what a security key's answers use ---

type Cbor =
  | number
  | string
  | boolean
  | null
  | Uint8Array
  | Cbor[]
  | Map<Cbor, Cbor>;

/** Reads one CBOR item at `start`. Returns it and where the next item starts. */
export function readCbor(
  bytes: Uint8Array,
  start = 0,
  depth = 0,
): [Cbor, number] {
  if (depth > 8) fail('CBOR nested too deep');
  let pos = start;
  const take = (n: number) => {
    if (pos + n > bytes.length) fail('CBOR ends early');
    const slice = bytes.subarray(pos, pos + n);
    pos += n;
    return slice;
  };
  const head = take(1)[0];
  const major = head >> 5;
  const info = head & 0x1f;
  let arg: number;
  if (info < 24) arg = info;
  else if (info === 24) arg = take(1)[0];
  else if (info === 25) {
    const b = take(2);
    arg = (b[0] << 8) | b[1];
  } else if (info === 26) {
    const b = take(4);
    arg = ((b[0] << 24) >>> 0) + ((b[1] << 16) | (b[2] << 8) | b[3]);
  } else fail('CBOR value not supported');

  switch (major) {
    case 0:
      return [arg, pos];
    case 1:
      return [-1 - arg, pos];
    case 2:
      return [take(arg).slice(), pos];
    case 3:
      return [utf8Decode(take(arg)), pos];
    case 4: {
      const list: Cbor[] = [];
      for (let i = 0; i < arg; i++) {
        const [item, next] = readCbor(bytes, pos, depth + 1);
        list.push(item);
        pos = next;
      }
      return [list, pos];
    }
    case 5: {
      const map = new Map<Cbor, Cbor>();
      for (let i = 0; i < arg; i++) {
        const [key, afterKey] = readCbor(bytes, pos, depth + 1);
        const [value, afterValue] = readCbor(bytes, afterKey, depth + 1);
        map.set(key, value);
        pos = afterValue;
      }
      return [map, pos];
    }
    case 7:
      if (info === 20) return [false, pos];
      if (info === 21) return [true, pos];
      if (info === 22) return [null, pos];
      return fail('CBOR value not supported');
    default:
      return fail('CBOR value not supported');
  }
}

// --- Authenticator data ---

export interface AuthData {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  credentialId?: Uint8Array;
  /** Uncompressed P-256 public key: 0x04, x, y (65 bytes). */
  publicKey?: Uint8Array;
}

export function parseAuthData(bytes: Uint8Array): AuthData {
  if (bytes.length < 37) fail('Key data too short');
  const rpIdHash = bytes.slice(0, 32);
  const flags = bytes[32];
  const signCount =
    ((bytes[33] << 24) >>> 0) +
    ((bytes[34] << 16) | (bytes[35] << 8) | bytes[36]);
  if (!(flags & FLAG_ATTESTED)) return { rpIdHash, flags, signCount };

  if (bytes.length < 55) fail('Key data too short');
  const idLength = (bytes[53] << 8) | bytes[54];
  const idEnd = 55 + idLength;
  if (idLength === 0 || idEnd > bytes.length) fail('Key ID missing');
  const credentialId = bytes.slice(55, idEnd);
  const [cose] = readCbor(bytes, idEnd);
  if (!(cose instanceof Map)) fail('Key not readable');
  const x = cose.get(-2);
  const y = cose.get(-3);
  const ok =
    cose.get(1) === 2 && // EC2
    cose.get(3) === -7 && // ES256
    cose.get(-1) === 1 && // P-256
    x instanceof Uint8Array &&
    y instanceof Uint8Array &&
    x.length === 32 &&
    y.length === 32;
  if (!ok) fail('This kind of key is not supported');
  const publicKey = new Uint8Array(65);
  publicKey[0] = 0x04;
  publicKey.set(x as Uint8Array, 1);
  publicKey.set(y as Uint8Array, 33);
  return { rpIdHash, flags, signCount, credentialId, publicKey };
}

function checkClientData(
  clientDataJSON: Uint8Array,
  type: 'webauthn.create' | 'webauthn.get',
  challenge: Uint8Array,
) {
  let data: {
    type?: unknown;
    challenge?: unknown;
    origin?: unknown;
    crossOrigin?: unknown;
  };
  try {
    data = JSON.parse(utf8Decode(clientDataJSON));
  } catch {
    return fail('Key answer not readable');
  }
  if (data.type !== type) fail('Key answer is of the wrong kind');
  if (typeof data.challenge !== 'string') fail('Key answer has no challenge');
  if (!equalBytes(fromBase64(data.challenge), challenge)) {
    fail('Key answer is for another request');
  }
  // Audit C-47: when the answer names where it was made, it must be Zecky's
  // own site, and never from inside another site's frame.
  if (data.origin !== undefined && data.origin !== `https://${RP_ID}`) {
    fail('Key answer is for another app or site');
  }
  if (data.crossOrigin === true) fail('Key answer is for another app or site');
}

function checkRp(auth: AuthData) {
  if (!equalBytes(auth.rpIdHash, sha256(utf8ToBytes(RP_ID)))) {
    fail('Key answer is for another app or site');
  }
  if (!(auth.flags & FLAG_USER_PRESENT)) fail('The key was not touched');
}

// --- Pairing ---

export interface Registration {
  credentialId: string;
  attestationObject: string;
  clientDataJSON: string;
}

export interface PairedKey {
  /** Credential ID, base64. */
  id: string;
  /** Uncompressed P-256 public key, base64. */
  publicKey: string;
  signCount: number;
}

/** Checks a new key's answer and returns what Zecky keeps of it. */
export function readRegistration(
  reg: Registration,
  challenge: Uint8Array,
): PairedKey {
  checkClientData(fromBase64(reg.clientDataJSON), 'webauthn.create', challenge);
  const [attestation] = readCbor(fromBase64(reg.attestationObject));
  if (!(attestation instanceof Map)) fail('Key answer not readable');
  const authBytes = attestation.get('authData');
  if (!(authBytes instanceof Uint8Array)) fail('Key answer not readable');
  const auth = parseAuthData(authBytes);
  checkRp(auth);
  if (!auth.credentialId || !auth.publicKey) fail('Key ID missing');
  if (!equalBytes(auth.credentialId, fromBase64(reg.credentialId))) {
    fail('Key ID does not match');
  }
  return {
    id: toBase64(auth.credentialId),
    publicKey: toBase64(auth.publicKey),
    signCount: auth.signCount,
  };
}

// --- Checking a key at release ---

export interface Assertion {
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}

/**
 * Checks everything in a key's answer except the signature itself, and
 * returns the paired key it came from plus its new counter.
 */
export function readAssertion(
  answer: Assertion,
  challenge: Uint8Array,
  keys: PairedKey[],
): { key: PairedKey; signCount: number } {
  const id = fromBase64(answer.credentialId);
  const key = keys.find(k => equalBytes(fromBase64(k.id), id));
  if (!key) fail('This is not one of your keys');
  checkClientData(fromBase64(answer.clientDataJSON), 'webauthn.get', challenge);
  const auth = parseAuthData(fromBase64(answer.authenticatorData));
  checkRp(auth);
  // Keys count their uses. A count that goes backwards means a copied key.
  // Keys that do not count always answer 0.
  if (auth.signCount !== 0 || key.signCount !== 0) {
    if (auth.signCount <= key.signCount) fail('This key may have been copied');
  }
  return { key, signCount: auth.signCount };
}
