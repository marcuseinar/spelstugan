/**
 * Test helpers for building specific Ludo positions.
 *
 * Reaching an interesting position by playing legal moves would take hundreds
 * of dice rolls, so tests construct the position directly and assert on the
 * rule under examination.
 */

import { BASE } from './board.js';
import type { LudoShared, Phase, Seat } from './state.js';

export interface PositionOptions {
  /** Token progress per seat. Missing tokens default to base. */
  readonly tokens: readonly (readonly number[])[];
  readonly currentSeat?: number;
  readonly phase?: Phase;
  readonly lastRoll?: number | null;
  readonly consecutiveSixes?: number;
  readonly winner?: string | null;
}

const TOKENS = 4;

function seatFrom(playerId: string, tokens: readonly number[]): Seat {
  return {
    playerId,
    tokens: Array.from({ length: TOKENS }, (_, index) => tokens[index] ?? BASE),
  };
}

/** Builds a position from token progress values, filling in sensible defaults. */
export function position(options: PositionOptions): LudoShared {
  return {
    seats: options.tokens.map((tokens, index) => seatFrom(`p${index}`, tokens)),
    currentSeat: options.currentSeat ?? 0,
    phase: options.phase ?? 'move',
    lastRoll: options.lastRoll ?? null,
    consecutiveSixes: options.consecutiveSixes ?? 0,
    winner: options.winner ?? null,
  };
}
