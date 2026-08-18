/**
 * Ludo board geometry.
 *
 * A token's position is a single number, its *progress*: how far it has come
 * along its own path. Every player walks the same shape, just entering the
 * shared track at a different place, so one number plus the player's seat is
 * enough to place a token — no per-player coordinate tables.
 *
 *   progress -1            in base, not yet in play
 *   progress 0 .. 51       on the shared track
 *   progress 52 .. 56      in the home column, safe from capture
 *   progress 57            home
 */

export const TRACK_LENGTH = 52;
export const BASE = -1;
export const TRACK_START = 0;
export const TRACK_END = 51;
export const HOME_COLUMN_START = 52;
export const HOME = 57;

/** Seats are spaced evenly around the track. */
export const SEATS = 4;
export const SEAT_SPACING = TRACK_LENGTH / SEATS;

export const TOKENS_PER_PLAYER = 4;
export const DIE_FACES = 6;
/** Only a six releases a token from base. */
export const RELEASE_ROLL = 6;
/** Three sixes in a row forfeits the turn, so a lucky streak can't run forever. */
export const MAX_CONSECUTIVE_SIXES = 3;

/** Where a seat joins the shared track. */
export function startCellForSeat(seat: number): number {
  return seat * SEAT_SPACING;
}

/**
 * The shared-track cell a token occupies, or null if it is in base or past the
 * track (home column or home), where tokens cannot meet each other.
 */
export function trackCell(seat: number, progress: number): number | null {
  if (progress < TRACK_START || progress > TRACK_END) {
    return null;
  }
  return (startCellForSeat(seat) + progress) % TRACK_LENGTH;
}

/**
 * Cells where a token cannot be captured: every seat's entry cell, and a star
 * cell partway round from each. Being able to see safety on the board is what
 * makes the risk of advancing readable to players.
 */
const SAFE_CELLS: ReadonlySet<number> = new Set(
  Array.from({ length: SEATS }, (_, seat) => [
    startCellForSeat(seat),
    (startCellForSeat(seat) + 8) % TRACK_LENGTH,
  ]).flat(),
);

export function isSafeCell(cell: number): boolean {
  return SAFE_CELLS.has(cell);
}

export function isInBase(progress: number): boolean {
  return progress === BASE;
}

export function isHome(progress: number): boolean {
  return progress === HOME;
}

/** In the home column: past the shared track, not yet home. */
export function isInHomeColumn(progress: number): boolean {
  return progress >= HOME_COLUMN_START && progress < HOME;
}
