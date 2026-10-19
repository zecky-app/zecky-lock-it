import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { osRandomBytes } from './nativeRandom';

// Everything that becomes a key starts here. The rule, learned from wallets
// that got this wrong: the secure generator is the only acceptable primary
// source, a failure must stop wallet creation, and nothing may quietly
// substitute weaker randomness.

// --- A second, independent source ---
// The exact timing of the user's taps and of app events is unpredictable to
// an outsider. It is far too weak to rely on alone, but mixed in with a hash
// it can only add to the secure generator's output, never take away from it.
const POOL_SIZE = 64;
const pool: number[] = [];

function clock(): number {
  const perf = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
}

/** Call on user interaction; cheap, and feeds the second source. */
export function noteEvent(): void {
  pool.push(clock());
  if (pool.length > POOL_SIZE) pool.shift();
}

function poolBytes(): Uint8Array {
  return utf8ToBytes(
    [...pool, clock(), Date.now(), Math.random(), Math.random()].join('|'),
  );
}

// --- Checks on what the secure generator returned ---
function looksBroken(bytes: Uint8Array): boolean {
  // 32 truly random bytes all but always contain far more than 8 different
  // values. A stuck, zeroed or counting-down generator does not.
  return new Set(bytes).size < 8;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

let previous: Uint8Array | null = null;

/**
 * `length` bytes for key material: two separate draws from the secure
 * generator, checked, then hashed together with the second source.
 * Throws instead of returning anything doubtful.
 */
export function secureEntropy(length = 32): Uint8Array {
  if (length < 16 || length > 32) throw new Error('Unsupported key length');
  const first = osRandomBytes(32);
  const second = osRandomBytes(32);
  if (looksBroken(first) || looksBroken(second) || same(first, second)) {
    throw new Error(
      'This phone’s secure random generator is not working correctly. For your safety no wallet was created.',
    );
  }
  if (previous != null && same(previous, first)) {
    throw new Error(
      'The secure random generator repeated itself. For your safety no wallet was created.',
    );
  }
  previous = first;
  const mixed = sha256(
    concatBytes(utf8ToBytes('zecky-entropy-v1'), first, second, poolBytes()),
  );
  return mixed.slice(0, length);
}
