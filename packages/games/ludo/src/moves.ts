/**
 * Ludo move legality and resolution — the rules proper.
 *
 * Kept apart from the reducer so the rules can be read, and tested, without
 * the turn-taking machinery around them.
 */

import {
  BASE,
  HOME,
  RELEASE_ROLL,
  TRACK_START,
  isHome,
  isInBase,
  isSafeCell,
  trackCell,
} from './board.js';
import type { LudoShared, Seat } from './state.js';

/**
 * Where a token would land, or null if the roll cannot legally be spent on it.
 *
 * Three separate reasons a token can't move, each its own guard:
 *   - it is home already, and done;
 *   - it is in base, and only a six releases it;
 *   - the roll would overshoot home, which must be reached exactly.
 */
export function destinationFor(progress: number, roll: number): number | null {
  if (isHome(progress)) {
    return null;
  }
  if (isInBase(progress)) {
    return roll === RELEASE_ROLL ? TRACK_START : null;
  }

  const destination = progress + roll;
  return destination > HOME ? null : destination;
}

/** True if this seat already occupies the shared-track cell the token would land on. */
function ownTokenBlocks(seat: Seat, seatIndex: number, destination: number): boolean {
  const destinationCell = trackCell(seatIndex, destination);
  if (destinationCell === null) {
    return false;
  }
  return seat.tokens.some((progress) => trackCell(seatIndex, progress) === destinationCell);
}

/**
 * Whether a specific token can legally be moved with this roll.
 *
 * Split from `destinationFor` because "the roll doesn't reach" and "your own
 * token is in the way" are different rules, and the tests isolate them.
 */
export function canMoveToken(
  shared: LudoShared,
  seatIndex: number,
  tokenIndex: number,
  roll: number,
): boolean {
  const seat = shared.seats[seatIndex];
  if (seat === undefined) {
    return false;
  }

  const progress = seat.tokens[tokenIndex];
  if (progress === undefined) {
    return false;
  }

  const destination = destinationFor(progress, roll);
  if (destination === null) {
    return false;
  }

  return !ownTokenBlocks(seat, seatIndex, destination);
}

/** Every token this seat could legally move with this roll. */
export function legalTokenIndices(
  shared: LudoShared,
  seatIndex: number,
  roll: number,
): readonly number[] {
  const seat = shared.seats[seatIndex];
  if (seat === undefined) {
    return [];
  }

  return seat.tokens
    .map((_, tokenIndex) => tokenIndex)
    .filter((tokenIndex) => canMoveToken(shared, seatIndex, tokenIndex, roll));
}

export interface Capture {
  readonly seatIndex: number;
  readonly tokenIndex: number;
}

/**
 * Opponent tokens sent back to base by a landing.
 *
 * Nothing is captured in base, in the home column, or on a safe cell — so a
 * landing that isn't on the shared track can never capture.
 */
export function capturesAt(
  shared: LudoShared,
  movingSeatIndex: number,
  destination: number,
): readonly Capture[] {
  const destinationCell = trackCell(movingSeatIndex, destination);
  if (destinationCell === null || isSafeCell(destinationCell)) {
    return [];
  }

  const captures: Capture[] = [];
  shared.seats.forEach((seat, seatIndex) => {
    if (seatIndex === movingSeatIndex) {
      return;
    }
    seat.tokens.forEach((progress, tokenIndex) => {
      if (trackCell(seatIndex, progress) === destinationCell) {
        captures.push({ seatIndex, tokenIndex });
      }
    });
  });
  return captures;
}

/** A seat's tokens with one of them replaced — seats are never mutated in place. */
export function withToken(seat: Seat, tokenIndex: number, progress: number): Seat {
  return {
    ...seat,
    tokens: seat.tokens.map((existing, index) => (index === tokenIndex ? progress : existing)),
  };
}

/** Applies every capture, sending the captured tokens back to base. */
export function applyCaptures(
  seats: readonly Seat[],
  captures: readonly Capture[],
): readonly Seat[] {
  if (captures.length === 0) {
    return seats;
  }

  return seats.map((seat, seatIndex) => {
    const forThisSeat = captures.filter((capture) => capture.seatIndex === seatIndex);
    return forThisSeat.reduce(
      (updated, capture) => withToken(updated, capture.tokenIndex, BASE),
      seat,
    );
  });
}

export function hasWon(seat: Seat): boolean {
  return seat.tokens.every(isHome);
}
