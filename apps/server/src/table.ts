/**
 * One game table, as a Durable Object.
 *
 * A Durable Object is a single addressable object with its own storage and no
 * concurrency inside it, which is exactly the shape of a game table: one move
 * log, one strict order of events, one place the truth lives (decision 021).
 * Everything that decides anything lives in `@spelstugan/game-kit` and the
 * game plugins; what is left here is storage and dispatch.
 *
 * A table speaks in outcomes, never in status codes — mapping those to HTTP is
 * the Worker's job, and keeping it there means this class can be read as the
 * domain it is.
 */

import { DurableObject } from 'cloudflare:workers';
import { Session } from '@spelstugan/game-kit';
import { gameNamed } from './games.js';
import type { Json } from './json.js';
import { asJson } from './json.js';
import { TableStore } from './store.js';
import type { TableRecord } from './store.js';

export interface TableSummary {
  readonly code: string;
  readonly gameId: string;
  readonly players: readonly string[];
  readonly finished: boolean;
  readonly moveCount: number;
  readonly view: Json;
}

/** What the Worker asks of a table. Its own Worker is the only caller. */
export type TableCommand =
  | { readonly kind: 'seat'; readonly record: TableRecord }
  | { readonly kind: 'read'; readonly code: string; readonly viewer: string | null }
  | {
      readonly kind: 'play';
      readonly code: string;
      readonly player: string;
      readonly move: Json;
    };

export type TableAnswer =
  | { readonly outcome: 'seated' }
  | { readonly outcome: 'code-taken' }
  | { readonly outcome: 'no-table' }
  | { readonly outcome: 'table'; readonly table: TableSummary }
  | { readonly outcome: 'refused'; readonly reason: string }
  | {
      readonly outcome: 'played';
      readonly events: readonly Json[];
      readonly table: TableSummary;
    };

export class GameTable extends DurableObject {
  private readonly store = new TableStore(this.ctx.storage.sql);

  override async fetch(request: Request): Promise<Response> {
    // The caller is our own Worker, which has already validated the request;
    // re-checking its shape here would be defending against ourselves.
    const command = (await request.json()) as TableCommand;
    return Response.json(this.answer(command));
  }

  private answer(command: TableCommand): TableAnswer {
    switch (command.kind) {
      case 'seat':
        return this.seat(command.record);
      case 'read':
        return this.read(command.code, command.viewer);
      case 'play':
        return this.play(command.code, command.player, command.move);
    }
  }

  private seat(record: TableRecord): TableAnswer {
    if (this.store.seating() !== null) {
      return { outcome: 'code-taken' };
    }
    this.store.seat(record);
    return { outcome: 'seated' };
  }

  private read(code: string, viewer: string | null): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    return { outcome: 'table', table: this.summarize(code, seating, viewer) };
  }

  private play(code: string, player: string, move: Json): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    if (!seating.players.includes(player)) {
      return { outcome: 'refused', reason: `${player} is not seated at this table.` };
    }

    const session = this.sessionFor(seating);
    const result = session.attempt(move, player);
    if (!result.accepted) {
      return { outcome: 'refused', reason: result.reason ?? 'That move is not legal.' };
    }

    this.store.append({ playerId: player, move });
    return {
      outcome: 'played',
      events: result.events.map(asJson),
      table: this.summarize(code, seating, player),
    };
  }

  /**
   * Rebuilds the session from the stored log on every command.
   *
   * Holding one in memory between calls would be faster and would need a
   * reason to trust it; folding the log is quick at the length a board game
   * reaches, and it can only ever agree with what was stored.
   */
  private sessionFor(seating: TableRecord): Session<unknown, unknown, unknown> {
    const game = gameNamed(seating.gameId);
    if (game === undefined) {
      throw new Error(`This table plays ${seating.gameId}, which this server no longer has.`);
    }
    return new Session({
      game,
      seed: seating.seed,
      players: seating.players,
      log: this.store.log(),
    });
  }

  private summarize(code: string, seating: TableRecord, viewer: string | null): TableSummary {
    const session = this.sessionFor(seating);
    const seated = viewer !== null && seating.players.includes(viewer);
    return {
      code,
      gameId: seating.gameId,
      players: seating.players,
      finished: session.finished,
      moveCount: session.moveCount,
      view: asJson(session.viewFor(seated ? viewer : null)),
    };
  }
}
