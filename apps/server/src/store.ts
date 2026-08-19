/**
 * A table's durable record: who is playing, and every move they have made.
 *
 * The move log is append-only and is the source of truth — state is never
 * stored, only recomputed from here, which is what makes replay and resuming
 * the same mechanism (see `docs/ARCHITECTURE.md`).
 */

import type { LoggedMove } from '@spelstugan/game-kit';

export interface TableRecord {
  readonly gameId: string;
  readonly seed: string;
  readonly players: readonly string[];
}

/** The tables a `SqlStorage` holds. Created on first use, then left alone. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS seating (
    only_row INTEGER PRIMARY KEY CHECK (only_row = 1),
    game_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    players TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS moves (
    number INTEGER PRIMARY KEY AUTOINCREMENT,
    player TEXT NOT NULL,
    move TEXT NOT NULL
  );
`;

export class TableStore {
  constructor(private readonly sql: SqlStorage) {
    sql.exec(SCHEMA);
  }

  seat(record: TableRecord): void {
    this.sql.exec(
      'INSERT INTO seating (only_row, game_id, seed, players) VALUES (1, ?, ?, ?)',
      record.gameId,
      record.seed,
      JSON.stringify(record.players),
    );
  }

  /** The table's seating, or null if nobody has ever sat down here. */
  seating(): TableRecord | null {
    const rows = [
      ...this.sql.exec('SELECT game_id, seed, players FROM seating WHERE only_row = 1'),
    ];
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      gameId: String(row.game_id),
      seed: String(row.seed),
      players: JSON.parse(String(row.players)) as string[],
    };
  }

  append(entry: LoggedMove<unknown>): void {
    this.sql.exec(
      'INSERT INTO moves (player, move) VALUES (?, ?)',
      entry.playerId,
      JSON.stringify(entry.move),
    );
  }

  log(): LoggedMove<unknown>[] {
    return [...this.sql.exec('SELECT player, move FROM moves ORDER BY number')].map((row) => ({
      playerId: String(row.player),
      move: JSON.parse(String(row.move)) as unknown,
    }));
  }
}
