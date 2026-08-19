/**
 * The games this server can seat a table for.
 *
 * A registry rather than an import at the point of use: the platform must be
 * able to answer "what can we play?" without knowing any game by name, which
 * is the same property that lets a game be added without touching the server.
 */

import type { Game } from '@spelstugan/game-kit';
import { ludo } from '@spelstugan/ludo';

/**
 * Any game, whatever its state and move types are.
 *
 * The server never looks inside those types — it only passes them between the
 * client and the plugin, which is what the contract was shaped for.
 */
export type AnyGame = Game<unknown, unknown, unknown>;

const GAMES: readonly AnyGame[] = [ludo];

export function gameNamed(id: string): AnyGame | undefined {
  return GAMES.find((game) => game.id === id);
}

export function gameIds(): readonly string[] {
  return GAMES.map((game) => game.id);
}

/** Why this many players cannot sit at this game, or null if they can. */
export function seatingProblem(game: AnyGame, seats: number): string | null {
  if (seats < game.minPlayers) {
    return `${game.name} needs at least ${game.minPlayers} players.`;
  }
  if (seats > game.maxPlayers) {
    return `${game.name} seats at most ${game.maxPlayers} players.`;
  }
  return null;
}
