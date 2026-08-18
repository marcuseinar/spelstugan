/**
 * Ludo, as a game plugin.
 *
 * The reducer is pure: same state plus same move plus same seeded Rng always
 * yields the same result. That is what makes the move log replayable and a
 * result verifiable.
 */

import type {
  Game,
  GameEvent,
  MoveContext,
  MoveOutcome,
  PlayerId,
  SetupContext,
} from '@spelstugan/game-kit';
import { defaultView } from '@spelstugan/game-kit';
import { DIE_FACES, HOME, MAX_CONSECUTIVE_SIXES, RELEASE_ROLL, SEATS, isHome } from './board.js';
import { applyCaptures, capturesAt, hasWon, legalTokenIndices, withToken } from './moves.js';
import type { LudoMove, LudoSecret, LudoShared, LudoState } from './state.js';
import { createSeat, currentSeat, seatOf } from './state.js';

const MIN_PLAYERS = 2;

function reject(reason: string): MoveOutcome<LudoShared, LudoSecret> {
  return { accepted: false, reason };
}

function accept(
  shared: LudoShared,
  events: readonly GameEvent[],
): MoveOutcome<LudoShared, LudoSecret> {
  return { accepted: true, state: { shared, secret: {} }, events };
}

/** Hands the turn to the next seat and clears anything that was turn-local. */
function passTurnTo(shared: LudoShared, nextSeat: number): LudoShared {
  return {
    ...shared,
    currentSeat: nextSeat,
    phase: 'roll',
    lastRoll: null,
    consecutiveSixes: 0,
  };
}

function nextSeatAfter(shared: LudoShared, seatIndex: number): number {
  return (seatIndex + 1) % shared.seats.length;
}

/**
 * Rolling the die.
 *
 * Three outcomes, and the order of these checks is the rule: a third six
 * forfeits the turn even though a six would otherwise be the best roll there
 * is; and a roll with nothing to spend it on passes the turn rather than
 * leaving the player stuck holding it.
 */
function applyRoll(shared: LudoShared, context: MoveContext): MoveOutcome<LudoShared, LudoSecret> {
  const roll = context.rng.nextInt(DIE_FACES) + 1;
  const seatIndex = shared.currentSeat;
  const playerId = currentSeat(shared).playerId;
  const rolled: GameEvent = { type: 'rolled', playerId, roll };

  const consecutiveSixes = roll === RELEASE_ROLL ? shared.consecutiveSixes + 1 : 0;

  if (consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
    const passed = passTurnTo(shared, nextSeatAfter(shared, seatIndex));
    return accept(passed, [
      rolled,
      { type: 'turn-forfeited', playerId, reason: 'three-sixes' },
      { type: 'turn-ended', playerId },
    ]);
  }

  if (legalTokenIndices(shared, seatIndex, roll).length === 0) {
    const passed = passTurnTo(shared, nextSeatAfter(shared, seatIndex));
    return accept(passed, [
      rolled,
      { type: 'no-legal-move', playerId },
      { type: 'turn-ended', playerId },
    ]);
  }

  return accept({ ...shared, phase: 'move', lastRoll: roll, consecutiveSixes }, [rolled]);
}

/**
 * Whether the mover keeps the turn.
 *
 * Each of these earns another go on its own: a six, a capture, or bringing a
 * token home. They are checked independently — any one is enough.
 */
function earnsAnotherTurn(roll: number, captured: boolean, reachedHome: boolean): boolean {
  return roll === RELEASE_ROLL || captured || reachedHome;
}

/** Moving a token with the roll in hand. */
function applyTokenMove(
  shared: LudoShared,
  tokenIndex: number,
): MoveOutcome<LudoShared, LudoSecret> {
  const roll = shared.lastRoll;
  if (roll === null) {
    return reject('No roll to move with.');
  }

  const seatIndex = shared.currentSeat;
  const seat = currentSeat(shared);
  const playerId = seat.playerId;

  if (!legalTokenIndices(shared, seatIndex, roll).includes(tokenIndex)) {
    return reject(`Token ${tokenIndex} cannot move ${roll}.`);
  }

  // Legality was just established, so the token and its destination both exist.
  const from = seat.tokens[tokenIndex] as number;
  const destination = from === -1 ? 0 : from + roll;

  const captures = capturesAt(shared, seatIndex, destination);
  const movedSeats = applyCaptures(shared.seats, captures).map((existing, index) =>
    index === seatIndex ? withToken(existing, tokenIndex, destination) : existing,
  );

  const events: GameEvent[] = [{ type: 'moved', playerId, tokenIndex, from, to: destination }];
  for (const capture of captures) {
    events.push({
      type: 'captured',
      byPlayerId: playerId,
      playerId: (shared.seats[capture.seatIndex] as { playerId: PlayerId }).playerId,
      tokenIndex: capture.tokenIndex,
    });
  }

  const reachedHome = isHome(destination);
  if (reachedHome) {
    events.push({ type: 'token-home', playerId, tokenIndex });
  }

  const movedSeat = movedSeats[seatIndex] as (typeof movedSeats)[number];
  if (hasWon(movedSeat)) {
    events.push({ type: 'game-won', playerId });
    return accept(
      { ...shared, seats: movedSeats, phase: 'roll', lastRoll: null, winner: playerId },
      events,
    );
  }

  const moved: LudoShared = { ...shared, seats: movedSeats };

  if (earnsAnotherTurn(roll, captures.length > 0, reachedHome)) {
    return accept({ ...moved, phase: 'roll', lastRoll: null }, [
      ...events,
      { type: 'extra-turn', playerId },
    ]);
  }

  return accept(passTurnTo(moved, nextSeatAfter(moved, seatIndex)), [
    ...events,
    { type: 'turn-ended', playerId },
  ]);
}

export const ludo: Game<LudoShared, LudoSecret, LudoMove> = {
  id: 'ludo',
  name: 'Ludo',
  minPlayers: MIN_PLAYERS,
  maxPlayers: SEATS,

  setup({ players }: SetupContext) {
    if (players.length < MIN_PLAYERS || players.length > SEATS) {
      throw new RangeError(`Ludo seats ${MIN_PLAYERS}-${SEATS} players, got ${players.length}.`);
    }
    if (new Set(players).size !== players.length) {
      throw new Error('The same player cannot take two seats.');
    }

    return {
      shared: {
        seats: players.map(createSeat),
        currentSeat: 0,
        phase: 'roll',
        lastRoll: null,
        consecutiveSixes: 0,
        winner: null,
      },
      secret: {},
    };
  },

  applyMove(state: LudoState, move: LudoMove, playerId: PlayerId, context: MoveContext) {
    const { shared } = state;

    if (shared.winner !== null) {
      return reject('The game is over.');
    }
    if (seatOf(shared, playerId) === -1) {
      return reject('You are not seated in this game.');
    }
    if (currentSeat(shared).playerId !== playerId) {
      return reject('It is not your turn.');
    }
    if (move.type !== shared.phase) {
      return reject(`Expected a ${shared.phase}, got a ${move.type}.`);
    }

    return move.type === 'roll'
      ? applyRoll(shared, context)
      : applyTokenMove(shared, move.tokenIndex);
  },

  view: defaultView,

  isFinished(state: LudoState) {
    return state.shared.winner !== null;
  },
};

export { HOME };
