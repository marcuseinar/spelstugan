/**
 * Room codes: how a table is named and how a guest reaches it.
 *
 * A code is what someone reads aloud across a table or types into a phone, so
 * the alphabet leaves out the characters people confuse — no O against 0, no I
 * or L against 1 — and codes are compared case-insensitively.
 */

import type { Rng } from '@spelstugan/game-kit';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

/** A fresh room code. Collisions are the caller's problem to detect. */
export function createCode(rng: Rng): string {
  let code = '';
  for (let position = 0; position < CODE_LENGTH; position += 1) {
    code += ALPHABET[rng.nextInt(ALPHABET.length)];
  }
  return code;
}

/**
 * The canonical form of a code someone typed, or null if it isn't one.
 *
 * Validating here rather than at the storage layer keeps a malformed code from
 * ever naming a table — every code that reaches storage has been through this.
 */
export function normalizeCode(typed: string): string | null {
  const upper = typed.trim().toUpperCase();
  if (upper.length !== CODE_LENGTH) {
    return null;
  }
  return [...upper].every((character) => ALPHABET.includes(character)) ? upper : null;
}
