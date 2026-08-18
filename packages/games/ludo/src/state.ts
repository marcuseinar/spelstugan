/**
 * Ludo state and moves.
 *
 * Everything here is plain serializable data: it crosses the plugin boundary,
 * gets written to the move log, and gets read back on replay.
 */

import type { GameState, PlayerId } from '@spelstugan/game-kit';
import { BASE, TOKENS_PER_PLAYER } from './board.js';

/**
 * A turn has two beats: roll the die, then move a token. Splitting them means
 * the roll is recorded in the log as its own move, so a replay reproduces the
 * dice exactly rather than re-rolling them.
 */
export type Phase = 'roll' | 'move';

export interface Seat {
  readonly playerId: PlayerId;
  /** Progress of each of this seat's tokens. See board.ts. */
  readonly tokens: readonly number[];
}

export interface LudoShared {
  readonly seats: readonly Seat[];
  readonly currentSeat: number;
  readonly phase: Phase;
  /** The roll awaiting a token to spend it on; null while phase is 'roll'. */
  readonly lastRoll: number | null;
  /** Sixes rolled in a row by the current seat — three forfeits the turn. */
  readonly consecutiveSixes: number;
  readonly winner: PlayerId | null;
}

/** Ludo has no hidden information; the split exists for games that do. */
export type LudoSecret = Record<string, never>;

export type LudoState = GameState<LudoShared, LudoSecret>;

export type LudoMove =
  | { readonly type: 'roll' }
  | { readonly type: 'move'; readonly tokenIndex: number };

export function createSeat(playerId: PlayerId): Seat {
  return { playerId, tokens: Array.from({ length: TOKENS_PER_PLAYER }, () => BASE) };
}

export function seatOf(shared: LudoShared, playerId: PlayerId): number {
  return shared.seats.findIndex((seat) => seat.playerId === playerId);
}

export function currentSeat(shared: LudoShared): Seat {
  // The current seat index is an internal invariant, always in range.
  return shared.seats[shared.currentSeat] as Seat;
}
