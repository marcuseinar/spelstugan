/**
 * Where things sit on a drawn Ludo board.
 *
 * The board is the classic 15x15 cross. Only seat 0's geometry is written out;
 * the other three are quarter-turn rotations of it, which is both less code and
 * a guarantee that the seats are actually symmetric rather than approximately
 * so.
 */

import { BASE, HOME, HOME_COLUMN_START, TRACK_END, TRACK_LENGTH } from '../board.js';

export const GRID = 15;
/** The middle cell of the board, and the point every home column aims at. */
export const CENTRE = { column: 7, row: 7 } as const;

export interface Cell {
  readonly column: number;
  readonly row: number;
}

/** A quarter turn clockwise about the centre of the board. */
function rotateClockwise({ column, row }: Cell): Cell {
  return { column: GRID - 1 - row, row: column };
}

function rotateTimes(cell: Cell, turns: number): Cell {
  let rotated = cell;
  for (let turn = 0; turn < turns; turn += 1) {
    rotated = rotateClockwise(rotated);
  }
  return rotated;
}

/** Cells from `from` to `to` inclusive along a straight line. */
function line(from: Cell, to: Cell): Cell[] {
  const steps = Math.max(Math.abs(to.column - from.column), Math.abs(to.row - from.row));
  const stepColumn = Math.sign(to.column - from.column);
  const stepRow = Math.sign(to.row - from.row);

  return Array.from({ length: steps + 1 }, (_, step) => ({
    column: from.column + stepColumn * step,
    row: from.row + stepRow * step,
  }));
}

/**
 * The 52 shared-track cells, clockwise, starting at seat 0's entry cell.
 *
 * Traced as the outline of the cross: up one side of an arm, round its tip,
 * back down the other side, then on to the next arm. At the four points where
 * the cross is concave the squares meet corner-to-corner, so the path steps
 * diagonally there — four times in the circuit, and nowhere else.
 */
const TRACK: readonly Cell[] = [
  ...line({ column: 6, row: 14 }, { column: 6, row: 9 }),
  ...line({ column: 5, row: 8 }, { column: 0, row: 8 }),
  ...line({ column: 0, row: 7 }, { column: 0, row: 6 }),
  ...line({ column: 1, row: 6 }, { column: 5, row: 6 }),
  ...line({ column: 6, row: 5 }, { column: 6, row: 0 }),
  ...line({ column: 7, row: 0 }, { column: 8, row: 0 }),
  ...line({ column: 8, row: 1 }, { column: 8, row: 5 }),
  ...line({ column: 9, row: 6 }, { column: 14, row: 6 }),
  ...line({ column: 14, row: 7 }, { column: 14, row: 8 }),
  ...line({ column: 13, row: 8 }, { column: 9, row: 8 }),
  ...line({ column: 8, row: 9 }, { column: 8, row: 14 }),
  ...line({ column: 7, row: 14 }, { column: 7, row: 14 }),
];

/** Seat 0's home column, from its first square to the last before home. */
const HOME_COLUMN: readonly Cell[] = line({ column: 7, row: 13 }, { column: 7, row: 9 });

/** Seat 0's four resting places in its yard. */
const YARD: readonly Cell[] = [
  { column: 1.5, row: 10.5 },
  { column: 3.5, row: 10.5 },
  { column: 1.5, row: 12.5 },
  { column: 3.5, row: 12.5 },
];

/** The 52 shared-track cells in order, as seat 0 meets them. */
export function trackCells(): readonly Cell[] {
  return TRACK;
}

/** The board cell at a given index of the shared track. */
export function cellAtTrackIndex(index: number): Cell {
  // The track is a closed ring, so any index is meaningful once wrapped.
  const wrapped = ((index % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  return TRACK[wrapped] as Cell;
}

/** A seat's yard squares, where its tokens wait to be released. */
export function yardCells(seat: number): readonly Cell[] {
  return YARD.map((cell) => rotateTimes(cell, seat));
}

/** A seat's home column, nearest square first. */
export function homeColumnCells(seat: number): readonly Cell[] {
  return HOME_COLUMN.map((cell) => rotateTimes(cell, seat));
}

/** The corner region a seat's yard occupies, for drawing. */
export function yardArea(seat: number): { readonly corner: Cell; readonly size: number } {
  const corners: readonly Cell[] = [
    { column: 0, row: 9 },
    { column: 0, row: 0 },
    { column: 9, row: 0 },
    { column: 9, row: 9 },
  ];
  return { corner: corners[seat] as Cell, size: 6 };
}

/**
 * Where a token is drawn, given its seat and how far it has come.
 *
 * `tokenIndex` only matters in the yard, where the four tokens rest in
 * separate squares; everywhere else a token's position is its progress alone.
 */
export function tokenCell(seat: number, progress: number, tokenIndex: number): Cell {
  if (progress === BASE) {
    return yardCells(seat)[tokenIndex] as Cell;
  }
  if (progress === HOME) {
    return CENTRE;
  }
  if (progress >= HOME_COLUMN_START) {
    return homeColumnCells(seat)[progress - HOME_COLUMN_START] as Cell;
  }
  return cellAtTrackIndex(seatStartIndex(seat) + progress);
}

/** Where a seat joins the shared track, as an index into the drawn ring. */
export function seatStartIndex(seat: number): number {
  return (seat * TRACK_LENGTH) / 4;
}

/** True while a progress value places a token on the shared track. */
export function isOnTrack(progress: number): boolean {
  return progress >= 0 && progress <= TRACK_END;
}
