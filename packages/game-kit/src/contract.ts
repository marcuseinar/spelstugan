/**
 * The contract every game plugin implements.
 *
 * The platform owns identity, persistence, turn scheduling, chat and the move
 * log. A game owns its rules and nothing else. Everything crossing this
 * boundary is plain serializable data — never shared objects — so that a game
 * can later run inside a sandbox, or be written by someone we don't trust,
 * without the interface changing shape.
 */

import type { Rng } from './rng.js';

/** Identifies a User seated in a Session. Opaque to games. */
export type PlayerId = string;

/**
 * Game state, split by who is allowed to see it.
 *
 * Ludo leaves `secret` empty — it has no hidden information — but the split
 * exists from the first game because retrofitting it later, once persistence
 * and replays exist, would be far more expensive than carrying it now.
 */
export interface GameState<Shared, Secret> {
  /** Visible to everyone, spectators included. The board. */
  shared: Shared;
  /** Visible only to the player it is keyed under. The hand. */
  secret: Readonly<Record<PlayerId, Secret>>;
}

/**
 * Something worth recording that happened as a result of a move.
 *
 * The reducer emits events; it never acts on them. Acting is the platform's
 * job — notifying players, writing scores, ending a session.
 */
export interface GameEvent {
  type: string;
  [detail: string]: unknown;
}

/** Everything a reducer is allowed to know beyond the state and the move. */
export interface MoveContext {
  /** The only legitimate source of randomness inside a reducer. */
  rng: Rng;
}

/** Context for building the opening state of a session. */
export interface SetupContext {
  /** Seated players, in turn order. */
  players: readonly PlayerId[];
  rng: Rng;
}

/**
 * The outcome of attempting a move.
 *
 * A rejected move must leave state completely untouched — no partial
 * application. Rejection is an ordinary outcome, not an exception: illegal
 * moves are expected traffic from clients and are not a reason to crash.
 */
export type MoveOutcome<Shared, Secret> =
  | {
      readonly accepted: true;
      readonly state: GameState<Shared, Secret>;
      readonly events: readonly GameEvent[];
    }
  | { readonly accepted: false; readonly reason: string };

/**
 * A game's rules.
 *
 * `setup` and `applyMove` must be pure and deterministic: no clock reads, no
 * ambient randomness, no shared mutable state. Given the same inputs they
 * must always produce the same outputs, because replaying the move log is how
 * past states are reconstructed.
 */
export interface Game<Shared, Secret, Move> {
  readonly id: string;
  readonly name: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  /** Builds the opening state for a session. */
  setup(context: SetupContext): GameState<Shared, Secret>;

  /** Applies one attempted move, or explains why it isn't legal. */
  applyMove(
    state: GameState<Shared, Secret>,
    move: Move,
    playerId: PlayerId,
    context: MoveContext,
  ): MoveOutcome<Shared, Secret>;

  /**
   * What a given viewer may see.
   *
   * `null` means a spectator — a second screen, a TV, someone watching a
   * finished game — and yields the shared state only.
   */
  view(state: GameState<Shared, Secret>, viewerId: PlayerId | null): PlayerView<Shared, Secret>;

  /** True once the session has a result and accepts no further moves. */
  isFinished(state: GameState<Shared, Secret>): boolean;
}

/** What one viewer sees: everything shared, plus their own secrets if any. */
export interface PlayerView<Shared, Secret> {
  shared: Shared;
  /** Absent for spectators, and for players whose game has no hidden state. */
  own?: Secret;
}

/**
 * The default view: shared state for everyone, plus the viewer's own secret.
 *
 * Games only need their own `view` if they must reveal something more subtle
 * than "yours and everyone's" — a partially-revealed hand, say.
 */
export function defaultView<Shared, Secret>(
  state: GameState<Shared, Secret>,
  viewerId: PlayerId | null,
): PlayerView<Shared, Secret> {
  if (viewerId === null) {
    return { shared: state.shared };
  }
  const own = state.secret[viewerId];
  return own === undefined ? { shared: state.shared } : { shared: state.shared, own };
}
