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
  /** How many seats to open. Whether the game allows that many is its call. */
  readonly seats: number;
}

export interface JoinRequest {
  readonly name: string;
}

export interface MessageRequest {
  readonly author: string;
  readonly text: string;
}

export interface MoveRequest {
  readonly player: string;
  readonly move: unknown;
}

/** Long enough for a name someone chose, short enough not to break a layout. */
export const MAX_NAME_LENGTH = 24;

export function parseTableRequest(body: unknown): Validated<TableRequest> {
  if (!isRecord(body)) {
    return rejected('Expected a JSON object.');
  }

  const gameId = body.game;
  if (typeof gameId !== 'string' || gameId === '') {
    return rejected('Name the game to play, as "game".');
  }

  const seats = body.seats;
  if (!Number.isInteger(seats)) {
    return rejected('Say how many seats to open, as "seats".');
  }
  return { ok: true, value: { gameId, seats: seats as number } };
}

export function parseJoinRequest(body: unknown): Validated<JoinRequest> {
  if (!isRecord(body)) {
    return rejected('Expected a JSON object.');
  }
  if (!isName(body.name)) {
    return rejected(`Pick a name of 1 to ${MAX_NAME_LENGTH} characters, as "name".`);
  }
  return { ok: true, value: { name: body.name } };
}

/** Long enough to say something, short enough that nobody pastes a novel. */
export const MAX_MESSAGE_LENGTH = 500;

export function parseMessageRequest(body: unknown): Validated<MessageRequest> {
  if (!isRecord(body)) {
    return rejected('Expected a JSON object.');
  }
  if (!isName(body.author)) {
    return rejected('Say who is speaking, as "author".');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text === '') {
    return rejected('Say something, as "text".');
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return rejected(`A message can be at most ${MAX_MESSAGE_LENGTH} characters.`);
  }
  return { ok: true, value: { author: body.author, text } };
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
