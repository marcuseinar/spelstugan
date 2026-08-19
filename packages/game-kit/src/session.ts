/**
 * A game session: a move log, the rules, and the state derived from folding
 * one through the other.
 *
 * Nothing here knows about any particular game. It holds no storage either —
 * a session is given its log and hands it back, and whoever owns durability
 * decides where that log lives. In the browser that is memory; on the server
 * it is the platform's storage. Both resume the same way, because state is
 * always a recomputation from the log.
 */

import type { Game, GameEvent, GameState, PlayerId } from './contract.js';
import type { LoggedMove } from './replay.js';
import { replay, seedForMove } from './replay.js';
import { createRng } from './rng.js';

export interface AttemptResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly events: readonly GameEvent[];
}

export interface SessionSetup<Shared, Secret, Move> {
  readonly game: Game<Shared, Secret, Move>;
  /** Seeds every move's randomness. The same seed replays the same game. */
  readonly seed: string;
  /** Seated players, in turn order. */
  readonly players: readonly PlayerId[];
  /** Moves already played. Omitted for a new session. */
  readonly log?: readonly LoggedMove<Move>[];
}

export class Session<Shared, Secret, Move> {
  private readonly game: Game<Shared, Secret, Move>;
  private readonly seed: string;
  private readonly log: LoggedMove<Move>[];
  private state: GameState<Shared, Secret>;

  readonly players: readonly PlayerId[];

  constructor(setup: SessionSetup<Shared, Secret, Move>) {
    this.game = setup.game;
    this.seed = setup.seed;
    this.players = setup.players;
    this.log = [...(setup.log ?? [])];
    this.state = replay(setup.game, setup.seed, setup.players, this.log).state;
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
