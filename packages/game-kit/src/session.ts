/**
 * A game session held in memory.
 *
 * This is the shape the server will eventually take, kept deliberately small:
 * hold a move log, apply attempted moves through the rules, and serve views.
 * Nothing here knows about any particular game.
 *
 * It is not persistence — state lives only as long as the object does. What it
 * does establish is that the move log is the record and everything else is
 * derived from it, which is the property the eventual server must keep.
 */

import type { Game, GameEvent, GameState, PlayerId } from './contract.js';
import type { LoggedMove } from './replay.js';
import { seedForMove } from './replay.js';
import { createRng } from './rng.js';

export interface AttemptResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly events: readonly GameEvent[];
}

export class Session<Shared, Secret, Move> {
  private state: GameState<Shared, Secret>;
  private readonly log: LoggedMove<Move>[] = [];

  constructor(
    private readonly game: Game<Shared, Secret, Move>,
    private readonly seed: string,
    readonly players: readonly PlayerId[],
  ) {
    this.state = game.setup({ players, rng: createRng(seedForMove(seed, 0)) });
  }

  /**
   * Attempts a move.
   *
   * Only accepted moves reach the log — it is the record of what happened, not
   * of what was tried, which is what lets a replay trust it.
   */
  attempt(move: Move, playerId: PlayerId): AttemptResult {
    const rng = createRng(seedForMove(this.seed, this.log.length + 1));
    const outcome = this.game.applyMove(this.state, move, playerId, { rng });

    if (!outcome.accepted) {
      return { accepted: false, reason: outcome.reason, events: [] };
    }

    this.state = outcome.state;
    this.log.push({ playerId, move });
    return { accepted: true, events: outcome.events };
  }

  /** What a given viewer may see. Null for a spectator. */
  viewFor(viewerId: PlayerId | null) {
    return this.game.view(this.state, viewerId);
  }

  /** Whoever the rules are waiting on, for a hot-seat client to act as. */
  get moveCount(): number {
    return this.log.length;
  }

  get finished(): boolean {
    return this.game.isFinished(this.state);
  }

  /** The move log, which is the real record — state is derived from it. */
  history(): readonly LoggedMove<Move>[] {
    return this.log;
  }
}
