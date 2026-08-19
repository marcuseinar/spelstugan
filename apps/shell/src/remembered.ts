/**
 * The tables this browser has sat at.
 *
 * There are no accounts, so there is no "your games" on a server to read back
 * (decision 022). What there is: this browser knows which codes it claimed a
 * seat at and under what name, which is enough to walk back into a game after
 * closing the tab — and enough to be honest that the list is local, not an
 * identity.
 */

export interface RememberedTable {
  readonly code: string;
  /** The name this browser sat down as. Different tables may use different ones. */
  readonly name: string;
}

/** Where the list lives. One key, so clearing it is one thing to explain. */
export const STORAGE_KEY = 'spelstugan:tables';

/**
 * How many to keep.
 *
 * Long enough to cover the games anyone has going at once, short enough that
 * the list stays a list rather than an archive nobody asked for.
 */
export const MAX_REMEMBERED = 12;

/**
 * The list with this table at the front.
 *
 * Newest first, one entry per code, oldest dropped past the cap. Re-seating at
 * a table already known moves it to the front rather than duplicating it.
 */
export function remembering(
  tables: readonly RememberedTable[],
  entry: RememberedTable,
): RememberedTable[] {
  const others = tables.filter((table) => table.code !== entry.code);
  return [entry, ...others].slice(0, MAX_REMEMBERED);
}

/** The list without this table, for one the player is done with. */
export function forgetting(tables: readonly RememberedTable[], code: string): RememberedTable[] {
  return tables.filter((table) => table.code !== code);
}

/** The name this browser sat at that table under, if it ever did. */
export function nameAt(tables: readonly RememberedTable[], code: string): string | null {
  return tables.find((table) => table.code === code)?.name ?? null;
}

/**
 * Reads a stored list back, keeping only what still looks like a table.
 *
 * Storage is a boundary: it holds whatever an older version wrote, or whatever
 * somebody typed into a console. Anything unrecognisable is dropped rather
 * than trusted or thrown over.
 */
export function tablesIn(stored: unknown): RememberedTable[] {
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter(isTable).slice(0, MAX_REMEMBERED);
}

function isTable(candidate: unknown): candidate is RememberedTable {
  // The `typeof` half states the intent rather than changing the outcome —
  // reading a property off a primitive is already undefined — so mutation
  // testing reports it as an equivalent survivor rather than a missing test.
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const { code, name } = candidate as { code?: unknown; name?: unknown };
  return typeof code === 'string' && code !== '' && typeof name === 'string' && name !== '';
}
