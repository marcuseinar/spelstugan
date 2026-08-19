/**
 * One game table, as a Durable Object.
 *
 * A Durable Object is a single addressable object with its own storage and no
 * concurrency inside it, which is exactly the shape of a game table: one move
 * log, one strict order of events, one place the truth lives (decision 021).
 * Everything that decides anything lives in `@spelstugan/game-kit` and the
 * game plugins; what is left here is storage and dispatch.
 *
 * A table has two lives. In the lobby it is a code and a set of empty seats,
 * and anyone holding the code may take one. Once started the seats close and
 * it is a game. A table speaks in outcomes, never in status codes — mapping
 * those to HTTP is the Worker's job.
 */

import { DurableObject } from 'cloudflare:workers';
import { Session } from '@spelstugan/game-kit';
import { gameNamed, seatingProblem } from './games.js';
import type { Json } from './json.js';
import { asJson } from './json.js';
import { TableStore } from './store.js';
import type { Message, TableRecord } from './store.js';

export interface TableSummary {
  readonly code: string;
  readonly gameId: string;
  /** How many seats the table has, filled or not. */
  readonly seats: number;
  /** Who has sat down, in turn order. */
  readonly players: readonly string[];
  readonly phase: 'lobby' | 'playing';
  readonly finished: boolean;
  readonly moveCount: number;
  /** The board, once there is one. Null while the table is still filling. */
  readonly view: Json | null;
  /** Everything said at this table, oldest first. */
  readonly messages: readonly Message[];
}

/** What the Worker asks of a table. Its own Worker is the only caller. */
export type TableCommand =
  | { readonly kind: 'open'; readonly code: string; readonly record: TableRecord }
  | { readonly kind: 'join'; readonly code: string; readonly name: string }
  | { readonly kind: 'start'; readonly code: string }
  | { readonly kind: 'read'; readonly code: string; readonly viewer: string | null }
  | {
      readonly kind: 'say';
      readonly code: string;
      readonly author: string;
      readonly text: string;
    }
  | {
      readonly kind: 'play';
      readonly code: string;
      readonly player: string;
      readonly move: Json;
    };

export type TableAnswer =
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
      case 'open':
        return this.open(command.code, command.record);
      case 'join':
        return this.join(command.code, command.name);
      case 'start':
        return this.start(command.code);
      case 'read':
        return this.read(command.code, command.viewer);
      case 'say':
        return this.say(command.code, command.author, command.text);
      case 'play':
        return this.play(command.code, command.player, command.move);
    }
  }

  private open(code: string, record: TableRecord): TableAnswer {
    if (this.store.seating() !== null) {
      return { outcome: 'code-taken' };
    }
    this.store.open(record);
    return { outcome: 'table', table: this.summarize(code, record, null) };
  }

  private join(code: string, name: string): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    if (this.store.started()) {
      return { outcome: 'refused', reason: 'This game has already started.' };
    }
    if (this.store.players().length >= seating.seats) {
      return { outcome: 'refused', reason: 'This table is full.' };
    }
    if (!this.store.claimSeat(name)) {
      return { outcome: 'refused', reason: `Somebody at this table is already called ${name}.` };
    }
    this.store.say({ kind: 'joined', text: `${name} sat down` });
    return { outcome: 'table', table: this.summarize(code, seating, null) };
  }

  private start(code: string): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    if (this.store.started()) {
      return { outcome: 'refused', reason: 'This game has already started.' };
    }

    const game = gameNamed(seating.gameId);
    if (game === undefined) {
      return { outcome: 'refused', reason: `This server no longer has ${seating.gameId}.` };
    }
    const problem = seatingProblem(game, this.store.players().length);
    if (problem !== null) {
      return { outcome: 'refused', reason: problem };
    }

    this.store.start();
    this.store.say({ kind: 'joined', text: 'The game started' });
    return { outcome: 'table', table: this.summarize(code, seating, null) };
  }

  private read(code: string, viewer: string | null): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    return { outcome: 'table', table: this.summarize(code, seating, viewer) };
  }

  /**
   * Says something at the table.
   *
   * Only the seated may speak. Anyone with the code can watch a game, and a
   * room whose code has been passed around is not a room where every reader
   * should be able to talk.
   */
  private say(code: string, author: string, text: string): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    if (!this.store.players().includes(author)) {
      return { outcome: 'refused', reason: `${author} is not seated at this table.` };
    }

    this.store.say({ kind: 'said', author, text });
    return { outcome: 'table', table: this.summarize(code, seating, author) };
  }

  private play(code: string, player: string, move: Json): TableAnswer {
    const seating = this.store.seating();
    if (seating === null) {
      return { outcome: 'no-table' };
    }
    if (!this.store.started()) {
      return { outcome: 'refused', reason: 'This game has not started yet.' };
    }
    if (!this.store.players().includes(player)) {
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
      players: this.store.players(),
      log: this.store.log(),
    });
  }

  private summarize(code: string, seating: TableRecord, viewer: string | null): TableSummary {
    const players = this.store.players();
    const common = {
      code,
      gameId: seating.gameId,
      seats: seating.seats,
      players,
      messages: this.store.messages(),
    };

    if (!this.store.started()) {
      return { ...common, phase: 'lobby', finished: false, moveCount: 0, view: null };
    }

    const session = this.sessionFor(seating);
    const seated = viewer !== null && players.includes(viewer);
    return {
      ...common,
      phase: 'playing',
      finished: session.finished,
      moveCount: session.moveCount,
      view: asJson(session.viewFor(seated ? viewer : null)),
    };
  }
}
