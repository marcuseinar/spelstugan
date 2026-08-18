/**
 * Replay: rebuilding state by folding the move log.
 *
 * State is never the source of truth — the move log is. Every past position is
 * a recomputation, which is what makes replay, spectating and resuming an
 * asynchronous game the same mechanism rather than three separate features.
 */

import type { Game, GameEvent, GameState, PlayerId } from './contract.js';
import { createRng } from './rng.js';

/** One accepted move, as stored in the log. */
export interface LoggedMove<Move> {
  readonly playerId: PlayerId;
  readonly move: Move;
}

export interface ReplayResult<Shared, Secret> {
  readonly state: GameState<Shared, Secret>;
  readonly events: readonly GameEvent[];
}

/**
 * Derives the Rng seed for a single move.
 *
 * Seeding per move — rather than threading one long-lived generator through
 * the session — is what lets any prefix of the log be replayed on its own, and
 * keeps the reducer from having to carry generator state around in game state.
 */
export function seedForMove(sessionSeed: string, moveNumber: number): string {
  return `${sessionSeed}:${moveNumber}`;
}

/**
 * Rebuilds state by applying a move log from the beginning.
 *
 * Throws if the log contains a move the rules reject: a stored log is supposed
 * to hold only accepted moves, so a rejection means the log and the rules have
 * diverged — corruption, or a game whose rules changed under a stored session.
 * That is a bug worth surfacing loudly, not smoothing over.
 */
export function replay<Shared, Secret, Move>(
  game: Game<Shared, Secret, Move>,
  sessionSeed: string,
  players: readonly PlayerId[],
  log: readonly LoggedMove<Move>[],
): ReplayResult<Shared, Secret> {
  let state = game.setup({ players, rng: createRng(seedForMove(sessionSeed, 0)) });
  const events: GameEvent[] = [];

  for (const [index, entry] of log.entries()) {
    const rng = createRng(seedForMove(sessionSeed, index + 1));
    const outcome = game.applyMove(state, entry.move, entry.playerId, { rng });

    if (!outcome.accepted) {
      throw new Error(
        `Move ${index} in the log was rejected on replay: ${outcome.reason}. The log and the rules have diverged.`,
      );
    }

    state = outcome.state;
    events.push(...outcome.events);
  }

  return { state, events };
}
