/**
 * Deterministic randomness for game reducers.
 *
 * Reducers must never reach for `Math.random()` — replay, spectating and
 * result verification all depend on the same inputs producing the same
 * outputs. The platform derives an Rng from the session seed plus the move
 * number and hands it to the reducer, so a replay of move N gets bit-identical
 * randomness to the original.
 */

export interface Rng {
  /** Uniform integer in [0, exclusiveMax). */
  nextInt(exclusiveMax: number): number;
  /** Uniform float in [0, 1). */
  nextFloat(): number;
  /** A new array holding the same items in a shuffled order. */
  shuffle<T>(items: readonly T[]): T[];
}

/**
 * Hashes an arbitrary seed string into a 32-bit integer.
 *
 * This is FNV-1a: not cryptographic, but well-distributed and stable across
 * platforms and runs — which is all determinism requires.
 */
function hashSeed(seed: string): number {
  const offsetBasis = 2166136261;
  const prime = 16777619;

  let hash = offsetBasis;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, prime);
  }
  return hash >>> 0;
}

/**
 * Creates a deterministic random source.
 *
 * The same seed always yields the same sequence. Seeds are strings so callers
 * can compose them meaningfully — `${sessionSeed}:${moveNumber}` — rather than
 * juggling numeric state.
 */
export function createRng(seed: string): Rng {
  // mulberry32: tiny, fast, and good enough for dice and shuffles.
  let state = hashSeed(seed);

  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  const nextInt = (exclusiveMax: number): number => {
    if (!Number.isInteger(exclusiveMax) || exclusiveMax < 1) {
      throw new RangeError(`exclusiveMax must be a positive integer, got ${exclusiveMax}`);
    }
    return Math.floor(nextFloat() * exclusiveMax);
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const shuffled = [...items];
    // Fisher-Yates, walking backwards so each position is chosen exactly once.
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapWith = nextInt(index + 1);
      const held = shuffled[index] as T;
      shuffled[index] = shuffled[swapWith] as T;
      shuffled[swapWith] = held;
    }
    return shuffled;
  };

  return { nextInt, nextFloat, shuffle };
}
