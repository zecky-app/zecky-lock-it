// Security key answers (FIDO2): the checks Zecky does before trusting one.
// The answers here are made with a real P-256 key from Node's crypto, in the
// same format a YubiKey uses.
/* eslint-disable no-bitwise */
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  PairedKey,
  RP_ID,
  fromBase64,
  readAssertion,
  readCbor,
  readRegistration,
  toBase64,
  toBase64Url,
} from '../src/lib/webauthn';

const fs = jest.requireActual<{
  readFileSync: (path: string, encoding: string) => string;
}>('fs');

type KeyObject = {
  export: (o: { format: 'jwk' }) => { x?: string; y?: string };
};
const { createHash, createSign, createVerify, generateKeyPairSync } =
  jest.requireActual<{
    createHash: (a: string) => {
      update: (d: Uint8Array | string) => { digest: () => Uint8Array };
    };
    createSign: (a: string) => {
      update: (d: Uint8Array) => void;
      sign: (k: KeyObject) => Uint8Array;
    };
    createVerify: (a: string) => {
      update: (d: Uint8Array) => void;
      verify: (k: KeyObject, s: Uint8Array) => boolean;
    };
    generateKeyPairSync: (
      t: 'ec',
      o: { namedCurve: string },
    ) => { privateKey: KeyObject; publicKey: KeyObject };
  }>('crypto');

// --- A tiny CBOR writer for the test answers ---
function head(major: number, n: number): number[] {
  if (n < 24) return [(major << 5) | n];
  if (n < 256) return [(major << 5) | 24, n];
  return [(major << 5) | 25, n >> 8, n & 0xff];
}
function cbor(value: unknown): number[] {
  if (typeof value === 'number') {
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }
  if (typeof value === 'string') {
    const bytes = [...utf8ToBytes(value)];
    return [...head(3, bytes.length), ...bytes];
  }
  if (value instanceof Uint8Array) return [...head(2, value.length), ...value];
  if (value instanceof Map) {
    const out = head(5, value.size);
    value.forEach((v, k) => out.push(...cbor(k), ...cbor(v)));
    return out;
  }
  throw new Error('not supported in test');
}

const sha = (data: Uint8Array | string) =>
  new Uint8Array(createHash('sha256').update(data).digest());

function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const x = fromBase64(jwk.x as string);
  const y = fromBase64(jwk.y as string);
  return { privateKey, publicKey, x, y };
}

function authData(opts: {
  rp?: string;
  flags: number;
  count: number;
  id?: Uint8Array;
  x?: Uint8Array;
  y?: Uint8Array;
}): Uint8Array {
  const out = [
    ...sha(opts.rp ?? RP_ID),
    opts.flags,
    (opts.count >>> 24) & 0xff,
    (opts.count >> 16) & 0xff,
    (opts.count >> 8) & 0xff,
    opts.count & 0xff,
  ];
  if (opts.id && opts.x && opts.y) {
    const cose = new Map<number, unknown>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, opts.x],
      [-3, opts.y],
    ]);
    out.push(
      ...new Array(16).fill(0),
      opts.id.length >> 8,
      opts.id.length & 0xff,
    );
    out.push(...opts.id, ...cbor(cose));
  }
  return new Uint8Array(out);
}

const clientData = (type: string, challenge: Uint8Array) =>
  utf8ToBytes(
    JSON.stringify({
      type,
      challenge: toBase64Url(challenge),
      origin: 'https://zecky.app',
    }),
  );

const challenge = new Uint8Array(32).map((_, i) => i * 7);
const credentialId = new Uint8Array(48).map((_, i) => 255 - i);

function registration(
  overrides: { rp?: string; flags?: number; type?: string } = {},
) {
  const key = newKey();
  const data = authData({
    rp: overrides.rp,
    flags: overrides.flags ?? 0x41,
    count: 0,
    id: credentialId,
    x: key.x,
    y: key.y,
  });
  const attestation = new Map<string, unknown>([
    ['fmt', 'none'],
    ['attStmt', new Map()],
    ['authData', data],
  ]);
  return {
    key,
    answer: {
      credentialId: toBase64(credentialId),
      attestationObject: toBase64(new Uint8Array(cbor(attestation))),
      clientDataJSON: toBase64(
        clientData(overrides.type ?? 'webauthn.create', challenge),
      ),
    },
  };
}

function assertion(
  privateKey: KeyObject,
  opts: { count?: number; flags?: number; rp?: string; id?: Uint8Array } = {},
) {
  const data = authData({
    rp: opts.rp,
    flags: opts.flags ?? 0x01,
    count: opts.count ?? 5,
  });
  const client = clientData('webauthn.get', challenge);
  const signer = createSign('SHA256');
  signer.update(concatBytes(data, sha(client)));
  return {
    credentialId: toBase64(opts.id ?? credentialId),
    authenticatorData: toBase64(data),
    clientDataJSON: toBase64(client),
    signature: toBase64(new Uint8Array(signer.sign(privateKey))),
  };
}

test('base64 goes both ways, standard and URL-safe', () => {
  const bytes = new Uint8Array(70).map((_, i) => (i * 37) & 0xff);
  expect(toBase64(new Uint8Array([102, 111, 111, 98]))).toBe('Zm9vYg==');
  expect(toBase64(new Uint8Array([102, 111, 111, 98, 97]))).toBe('Zm9vYmE=');
  expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
  expect([...fromBase64(toBase64Url(bytes))]).toEqual([...bytes]);
});

test('CBOR reader handles maps, text, bytes and negative numbers', () => {
  const [value] = readCbor(
    new Uint8Array(
      cbor(
        new Map<unknown, unknown>([
          [-3, new Uint8Array([1, 2])],
          ['a', 300],
        ]),
      ),
    ),
  );
  expect(value).toBeInstanceOf(Map);
  expect([...((value as Map<unknown, Uint8Array>).get(-3) ?? [])]).toEqual([
    1, 2,
  ]);
  expect((value as Map<unknown, number>).get('a')).toBe(300);
});

test('a genuine new key is read and its public key kept', () => {
  const { key, answer } = registration();
  const paired = readRegistration(answer, challenge);
  expect(paired.id).toBe(toBase64(credentialId));
  const pub = fromBase64(paired.publicKey);
  expect(pub.length).toBe(65);
  expect(pub[0]).toBe(4);
  expect([...pub.slice(1, 33)]).toEqual([...key.x]);
});

test('a new key for another site, another request or untouched is refused', () => {
  expect(() =>
    readRegistration(registration({ rp: 'evil.example' }).answer, challenge),
  ).toThrow(/another app or site/);
  expect(() =>
    readRegistration(registration().answer, new Uint8Array(32)),
  ).toThrow(/another request/);
  expect(() =>
    readRegistration(registration({ type: 'webauthn.get' }).answer, challenge),
  ).toThrow(/wrong kind/);
  expect(() =>
    readRegistration(registration({ flags: 0x40 }).answer, challenge),
  ).toThrow(/not touched/);
});

function pairedFrom(reg: ReturnType<typeof registration>): PairedKey {
  return readRegistration(reg.answer, challenge);
}

test('the signed message matches what CryptoKit checks: authData + SHA-256(clientData)', () => {
  const reg = registration();
  const answer = assertion(reg.key.privateKey);
  const verifier = createVerify('SHA256');
  verifier.update(
    concatBytes(
      fromBase64(answer.authenticatorData),
      sha(fromBase64(answer.clientDataJSON)),
    ),
  );
  expect(verifier.verify(reg.key.publicKey, fromBase64(answer.signature))).toBe(
    true,
  );
});

test('an answer from a paired key passes and returns its new count', () => {
  const reg = registration();
  const result = readAssertion(
    assertion(reg.key.privateKey, { count: 5 }),
    challenge,
    [pairedFrom(reg)],
  );
  expect(result.signCount).toBe(5);
});

test('answers from an unknown key, another site, an old request or untouched are refused', () => {
  const reg = registration();
  const keys = [pairedFrom(reg)];
  const p = reg.key.privateKey;
  expect(() =>
    readAssertion(assertion(p, { id: new Uint8Array(48) }), challenge, keys),
  ).toThrow(/not one of your keys/);
  expect(() =>
    readAssertion(assertion(p, { rp: 'evil.example' }), challenge, keys),
  ).toThrow(/another app or site/);
  expect(() => readAssertion(assertion(p), new Uint8Array(32), keys)).toThrow(
    /another request/,
  );
  expect(() =>
    readAssertion(assertion(p, { flags: 0 }), challenge, keys),
  ).toThrow(/not touched/);
});

test('a use count that goes backwards means a copied key; keys that do not count pass', () => {
  const reg = registration();
  const p = reg.key.privateKey;
  const used = { ...pairedFrom(reg), signCount: 10 };
  expect(() =>
    readAssertion(assertion(p, { count: 10 }), challenge, [used]),
  ).toThrow(/copied/);
  expect(() =>
    readAssertion(assertion(p, { count: 3 }), challenge, [used]),
  ).toThrow(/copied/);
  const notCounting = { ...pairedFrom(reg), signCount: 0 };
  expect(
    readAssertion(assertion(p, { count: 0 }), challenge, [notCounting])
      .signCount,
  ).toBe(0);
});

test('the native side uses the same site, keeps Zecky off the key and checks with CryptoKit', () => {
  const patch = fs.readFileSync(
    'patches/react-native-zcash+0.13.5.patch',
    'utf8',
  );
  expect(patch).toContain(`relyingParty = "${RP_ID}"`);
  expect(patch).toContain('residentKeyPreference = .discouraged');
  expect(patch).toContain('P256.Signing.PublicKey(x963Representation');
});

test('saved keys live in their own this-device-only Keychain item, cleared on erase', () => {
  const store = fs.readFileSync('src/lib/securityKey.ts', 'utf8');
  expect(store).toContain("'app.zecky.lockit.seckeys'");
  const fresh = fs.readFileSync('src/lib/freshInstall.ts', 'utf8');
  expect(fresh).toContain("'app.zecky.lockit.seckeys'");
});
