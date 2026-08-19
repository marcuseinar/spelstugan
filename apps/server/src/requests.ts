/**
 * Validating what arrived over the wire.
 *
 * This is a system boundary, so nothing past it is trusted: bodies are parsed
 * into known shapes here, and a caller that gets a `Valid` result can stop
 * defending itself. Rejection carries a sentence a client can show a person,
 * not a stack trace.
 */

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

export interface TableRequest {
  readonly gameId: string;
  readonly players: readonly string[];
}

export interface MoveRequest {
  readonly player: string;
  readonly move: unknown;
}

/** Long enough for a name someone chose, short enough not to break a layout. */
export const MAX_NAME_LENGTH = 24;
const MAX_PLAYERS = 8;

export function parseTableRequest(body: unknown): Validated<TableRequest> {
  if (!isRecord(body)) {
    return rejected('Expected a JSON object.');
  }

  const gameId = body.game;
  if (typeof gameId !== 'string' || gameId === '') {
    return rejected('Name the game to play, as "game".');
  }

  return withPlayers(gameId, body.players);
}

function withPlayers(gameId: string, players: unknown): Validated<TableRequest> {
  if (!Array.isArray(players) || players.length === 0) {
    return rejected('Seat at least one player, as "players".');
  }
  if (players.length > MAX_PLAYERS) {
    return rejected(`A table seats at most ${MAX_PLAYERS} players.`);
  }
  if (!players.every(isName)) {
    return rejected(`Every player needs a name of 1 to ${MAX_NAME_LENGTH} characters.`);
  }
  if (new Set(players).size !== players.length) {
    return rejected('Two players cannot share a name at the same table.');
  }
  return { ok: true, value: { gameId, players } };
}

export function parseMoveRequest(body: unknown): Validated<MoveRequest> {
  if (!isRecord(body)) {
    return rejected('Expected a JSON object.');
  }

  const player = body.player;
  if (!isName(player)) {
    return rejected('Say who is moving, as "player".');
  }
  if (body.move === undefined) {
    return rejected('Include the move, as "move".');
  }
  return { ok: true, value: { player, move: body.move } };
}

function isName(candidate: unknown): candidate is string {
  return (
    typeof candidate === 'string' && candidate.length > 0 && candidate.length <= MAX_NAME_LENGTH
  );
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

function rejected(reason: string): Validated<never> {
  return { ok: false, reason };
}
