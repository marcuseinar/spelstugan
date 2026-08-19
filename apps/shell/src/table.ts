/**
 * What an online table is doing, and what to say about it.
 *
 * The screen that shows a table is mostly rendering; the decisions it makes —
 * whether to keep asking the server, whether this player may act, what the
 * lobby should say — are here, where they can be read and tested without a
 * browser or a server.
 */

import type { TableMessage, TableSnapshot } from './api.js';
import type { ChatLine } from './chat.js';

/** How the player reached this table, which is what the code link carries. */
export const CODE_PARAMETER = 'table';

/** The link to send someone so they land on this table. */
export function invitationTo(pageUrl: string, code: string): string {
  const url = new URL(pageUrl);
  url.searchParams.set(CODE_PARAMETER, code);
  url.hash = '';
  return url.toString();
}

/** The code in a link someone opened, if it carried one worth following. */
export function codeInvitedTo(pageUrl: string): string | null {
  // `get` already answers null when the parameter is absent; the only extra
  // case is a parameter that is there and empty, which is not a code either.
  const carried = new URL(pageUrl).searchParams.get(CODE_PARAMETER);
  return carried === '' ? null : carried;
}

/**
 * The table to open when the link carried none: the most recent one.
 *
 * Landing on the game you were last playing beats landing on an empty form,
 * and this browser already knows which that was.
 */
export function rememberedCodeIn(tables: readonly { readonly code: string }[]): string | null {
  return tables[0]?.code ?? null;
}

/** Seats nobody has taken yet. */
export function seatsFree(table: TableSnapshot): number {
  return Math.max(0, table.seats - table.players.length);
}

/** Whether the game can begin: every seat taken is the simple rule. */
export function readyToStart(table: TableSnapshot): boolean {
  return table.phase === 'lobby' && seatsFree(table) === 0;
}

/**
 * What the lobby says while people arrive.
 *
 * Written for the person reading it, so it counts what is missing rather than
 * reporting what is present: nobody waiting in a doorway wants a status field.
 */
export function lobbyStatus(table: TableSnapshot): string {
  const free = seatsFree(table);
  if (free === 0) {
    return 'Everyone is here. Start when you are ready.';
  }
  return free === 1 ? 'Waiting for one more player.' : `Waiting for ${free} more players.`;
}

/**
 * The table's conversation, in the shape the chat renderer already draws.
 *
 * The server keeps what was said; the demo keeps its own in memory. Both end
 * up here so one renderer draws both, which is what stops the real thing and
 * the mockup drifting apart.
 */
export function chatLinesOf(table: TableSnapshot): ChatLine[] {
  return table.messages.map((message: TableMessage) => ({
    id: message.id,
    kind: message.kind,
    ...(message.author === undefined ? {} : { author: message.author }),
    text: message.text,
  }));
}

/** The newest line, for the collapsed sheet on a phone. */
export function latestLineOf(table: TableSnapshot): string {
  const last = table.messages.at(-1);
  if (last === undefined) {
    return 'No messages yet';
  }
  return last.author === undefined ? last.text : `${last.author}: ${last.text}`;
}

/**
 * Whether to ask the server again.
 *
 * A finished game will never change, so the polling stops there. Everything
 * else can change without this player doing anything — someone taking a seat,
 * someone else moving — which is exactly what polling is for.
 */
export function worthPolling(table: TableSnapshot | null): boolean {
  return table !== null && !table.finished;
}

/**
 * How long to wait before asking again.
 *
 * A lobby is watched by someone who is waiting, so it answers quickly. A game
 * where it is not your turn is watched by someone who has already acted and
 * will notice a second either way. Polling is a placeholder for the push
 * transport in `docs/ARCHITECTURE.md`, and these numbers are the cost of not
 * having it yet.
 */
export function millisecondsUntilNextPoll(table: TableSnapshot): number {
  return table.phase === 'lobby' ? 1500 : 2500;
}
