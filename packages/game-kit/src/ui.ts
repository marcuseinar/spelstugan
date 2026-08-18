/**
 * The contract a game's UI implements.
 *
 * Deliberately framework-neutral: a game UI is handed a DOM element and a way
 * to send moves, and nothing else. Requiring plugin authors to adopt our
 * frontend framework would be the same mistake as requiring them to adopt our
 * language — the platform shell can use whatever it likes and still host these.
 *
 * The UI never decides anything. It renders the view it is given and reports
 * intent; the rules live behind the reducer, where they can be verified.
 */

import type { PlayerView } from './contract.js';

export interface GameUiContext<Shared, Secret, Move> {
  /** What this viewer may see. Null `own` means a spectator. */
  view: PlayerView<Shared, Secret>;
  /**
   * Who is watching, or null for a spectator.
   *
   * A UI may use this to decide what is interactive, never what is legal —
   * a client that lies here still cannot make an illegal move, because the
   * reducer is the authority.
   */
  viewerId: string | null;
  /** Reports an attempted move. Acceptance comes back as a new view. */
  dispatch(move: Move): void;
}

export interface MountedGameUi<Shared, Secret> {
  /** Renders a new view. Called whenever state changes. */
  update(view: PlayerView<Shared, Secret>): void;
  /** Releases listeners and DOM. Must be safe to call twice. */
  destroy(): void;
}

export interface GameUi<Shared, Secret, Move> {
  mount(
    container: HTMLElement,
    context: GameUiContext<Shared, Secret, Move>,
  ): MountedGameUi<Shared, Secret>;
}
