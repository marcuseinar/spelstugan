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
  /** How many players the table was opened for. */
  readonly seats: number;
}

/**
 * The tables a `SqlStorage` holds. Created on first use, then left alone.
 *
 * Players are a table of their own rather than a list in one column, so that
 * claiming a seat is an insert the database can refuse: the unique name is
 * what stops two people racing for the same seat with the same name.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS schema_version (
    only_row INTEGER PRIMARY KEY CHECK (only_row = 1),
    version INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS seating (
    only_row INTEGER PRIMARY KEY CHECK (only_row = 1),
    game_id TEXT NOT NULL,
    seed TEXT NOT NULL,
    seats INTEGER NOT NULL,
    started INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS players (
    position INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS moves (
    number INTEGER PRIMARY KEY AUTOINCREMENT,
    player TEXT NOT NULL,
    move TEXT NOT NULL
  );
`;

const DROP_EVERYTHING = `
  DROP TABLE IF EXISTS moves;
  DROP TABLE IF EXISTS players;
  DROP TABLE IF EXISTS seating;
  DROP TABLE IF EXISTS schema_version;
`;

/**
 * Raise this whenever the shape above changes.
 *
 * A table whose storage was written by an older shape is emptied rather than
 * migrated. That is only defensible because nobody has played a game here
 * that anyone would miss: a move log is the product's memory, and throwing one
 * away must stop being acceptable the moment real players exist. When that
 * day comes this becomes a real migration and this comment becomes a lie —
 * see `docs/DECISIONS.md`, entry 022.
 */
const SCHEMA_VERSION = 2;

export class TableStore {
  constructor(private readonly sql: SqlStorage) {
    if (this.storedVersion() !== SCHEMA_VERSION) {
      sql.exec(DROP_EVERYTHING);
    }
    sql.exec(SCHEMA);
    sql.exec(
      'INSERT OR REPLACE INTO schema_version (only_row, version) VALUES (1, ?)',
      SCHEMA_VERSION,
    );
  }

  /** The version this storage was last written with, or 0 for empty storage. */
  private storedVersion(): number {
    try {
      return Number(this.first('SELECT version FROM schema_version WHERE only_row = 1')?.version);
    } catch {
      // No schema_version table at all: either brand new storage, or storage
      // from before versioning existed. Both want the same fresh start.
      return 0;
    }
  }

  open(record: TableRecord): void {
    this.sql.exec(
      'INSERT INTO seating (only_row, game_id, seed, seats) VALUES (1, ?, ?, ?)',
      record.gameId,
      record.seed,
      record.seats,
    );
  }

  /** The table's seating, or null if no table was ever opened here. */
  seating(): TableRecord | null {
    const row = this.first('SELECT game_id, seed, seats FROM seating WHERE only_row = 1');
    if (row === undefined) {
      return null;
    }
    return {
      gameId: String(row.game_id),
      seed: String(row.seed),
      seats: Number(row.seats),
    };
  }

  /** True once the game has begun and the seats are closed. */
  started(): boolean {
    return Number(this.first('SELECT started FROM seating WHERE only_row = 1')?.started) === 1;
  }

  start(): void {
    this.sql.exec('UPDATE seating SET started = 1 WHERE only_row = 1');
  }

  /** Players in the order they sat down, which is the order they play in. */
  players(): string[] {
    return [...this.sql.exec('SELECT name FROM players ORDER BY position')].map((row) =>
      String(row.name),
    );
  }

  /** Claims a seat. False if that name is already taken at this table. */
  claimSeat(name: string): boolean {
    if (this.players().includes(name)) {
      return false;
    }
    this.sql.exec('INSERT INTO players (name) VALUES (?)', name);
    return true;
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

  private first(query: string): Record<string, SqlStorageValue> | undefined {
    return [...this.sql.exec(query)][0];
  }
}
