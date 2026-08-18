import { describe, expect, it } from 'vitest';
import { BASE, HOME, HOME_COLUMN_START, SEATS, TRACK_LENGTH } from '../board.js';
import {
  CENTRE,
  type Cell,
  GRID,
  cellAtTrackIndex,
  homeColumnCells,
  isOnTrack,
  seatStartIndex,
  tokenCell,
  trackCells,
  yardArea,
  yardCells,
} from './geometry.js';

function key(cell: Cell): string {
  return `${cell.column},${cell.row}`;
}

/** The cross: three columns and three rows wide through the middle. */
function isOnCross({ column, row }: Cell): boolean {
  const inVerticalArm = column >= 6 && column <= 8;
  const inHorizontalArm = row >= 6 && row <= 8;
  return inVerticalArm || inHorizontalArm;
}

describe('the shared track', () => {
  const track = trackCells();

  it('has one cell per step of the circuit', () => {
    expect(track).toHaveLength(TRACK_LENGTH);
  });

  it('never visits the same cell twice', () => {
    expect(new Set(track.map(key)).size).toBe(TRACK_LENGTH);
  });

  it('stays within the board', () => {
    expect(
      track.every(({ column, row }) => column >= 0 && column < GRID && row >= 0 && row < GRID),
    ).toBe(true);
  });

  it('stays on the cross', () => {
    expect(track.every(isOnCross)).toBe(true);
  });

  /** Chebyshev distance: 1 for an orthogonal step, 1 for a diagonal one too. */
  function stepSize(from: Cell, to: Cell): number {
    return Math.max(Math.abs(to.column - from.column), Math.abs(to.row - from.row));
  }

  function isDiagonal(from: Cell, to: Cell): boolean {
    return from.column !== to.column && from.row !== to.row;
  }

  const steps = track.map((cell, index) => {
    const next = track[(index + 1) % TRACK_LENGTH] as Cell;
    return { from: cell, to: next };
  });

  it('never jumps more than one square', () => {
    expect(steps.every(({ from, to }) => stepSize(from, to) === 1)).toBe(true);
  });

  it('turns the corner diagonally exactly where the cross is concave', () => {
    // The four inner corners of the cross: the squares meet at a point, so the
    // path steps diagonally there. Anywhere else a diagonal would be a bug.
    expect(steps.filter(({ from, to }) => isDiagonal(from, to))).toHaveLength(4);
  });

  it('closes into a ring, the last cell adjacent to the first', () => {
    const last = track[TRACK_LENGTH - 1] as Cell;
    const first = track[0] as Cell;

    expect(stepSize(last, first)).toBe(1);
  });

  it('never runs through the centre', () => {
    expect(track.map(key)).not.toContain(key(CENTRE));
  });
});

describe('cellAtTrackIndex', () => {
  it('wraps past the end of the ring', () => {
    expect(cellAtTrackIndex(TRACK_LENGTH)).toEqual(cellAtTrackIndex(0));
  });

  it('wraps negative indices', () => {
    expect(cellAtTrackIndex(-1)).toEqual(cellAtTrackIndex(TRACK_LENGTH - 1));
  });

  it('wraps several times round', () => {
    expect(cellAtTrackIndex(TRACK_LENGTH * 3 + 5)).toEqual(cellAtTrackIndex(5));
  });
});

describe('seat symmetry', () => {
  it('spaces the seat entries a quarter-circuit apart', () => {
    const starts = Array.from({ length: SEATS }, (_, seat) => seatStartIndex(seat));

    expect(starts).toEqual([0, 13, 26, 39]);
  });

  it('gives each seat a distinct yard corner', () => {
    const corners = Array.from({ length: SEATS }, (_, seat) => key(yardArea(seat).corner));

    expect(new Set(corners).size).toBe(SEATS);
  });

  it('gives each seat four separate yard squares', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      const cells = yardCells(seat);

      expect(cells).toHaveLength(4);
      expect(new Set(cells.map(key)).size).toBe(4);
    }
  });

  it('keeps every seat’s yard inside its own corner', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      const { corner, size } = yardArea(seat);

      expect(
        yardCells(seat).every(
          ({ column, row }) =>
            column >= corner.column &&
            column <= corner.column + size &&
            row >= corner.row &&
            row <= corner.row + size,
        ),
      ).toBe(true);
    }
  });

  it('gives each seat a home column of the right length', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      expect(homeColumnCells(seat)).toHaveLength(HOME - HOME_COLUMN_START);
    }
  });

  it('never lets two seats share a home-column square', () => {
    const all = Array.from({ length: SEATS }, (_, seat) => homeColumnCells(seat)).flat();

    expect(new Set(all.map(key)).size).toBe(all.length);
  });

  it('runs every home column towards the centre', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      const cells = homeColumnCells(seat);
      const first = cells[0] as Cell;
      const last = cells[cells.length - 1] as Cell;

      const distance = (cell: Cell) =>
        Math.abs(cell.column - CENTRE.column) + Math.abs(cell.row - CENTRE.row);

      expect(distance(last)).toBeLessThan(distance(first));
    }
  });

  it('starts every home column one step past the seat’s last track cell', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      const lastTrackCell = cellAtTrackIndex(seatStartIndex(seat) + 51);
      const firstHomeCell = homeColumnCells(seat)[0] as Cell;
      const distance =
        Math.abs(lastTrackCell.column - firstHomeCell.column) +
        Math.abs(lastTrackCell.row - firstHomeCell.row);

      expect(distance).toBe(1);
    }
  });
});

describe('tokenCell', () => {
  it('places a token in base in its own yard square', () => {
    expect(tokenCell(0, BASE, 2)).toEqual(yardCells(0)[2]);
  });

  it('gives each of a seat’s base tokens a different square', () => {
    const cells = [0, 1, 2, 3].map((tokenIndex) => key(tokenCell(0, BASE, tokenIndex)));

    expect(new Set(cells).size).toBe(4);
  });

  it('places a token that has just left base on its seat’s entry cell', () => {
    expect(tokenCell(1, 0, 0)).toEqual(cellAtTrackIndex(seatStartIndex(1)));
  });

  it('advances along the track with progress', () => {
    expect(tokenCell(0, 5, 0)).toEqual(cellAtTrackIndex(5));
  });

  it('places a token in the home column once past the track', () => {
    expect(tokenCell(0, HOME_COLUMN_START, 0)).toEqual(homeColumnCells(0)[0]);
  });

  it('places the last home-column step next to the centre', () => {
    expect(tokenCell(0, HOME - 1, 0)).toEqual(homeColumnCells(0)[4]);
  });

  it('places a finished token at the centre', () => {
    expect(tokenCell(0, HOME, 0)).toEqual(CENTRE);
  });

  it('ignores the token index once a token is out of base', () => {
    expect(tokenCell(0, 5, 0)).toEqual(tokenCell(0, 5, 3));
  });

  it('lets two seats meet on one cell from different progress', () => {
    // Seat 1 enters 13 steps along seat 0's path, so these are the same square.
    expect(tokenCell(0, 13, 0)).toEqual(tokenCell(1, 0, 0));
  });

  it('keeps different seats apart at equal progress', () => {
    expect(tokenCell(0, 5, 0)).not.toEqual(tokenCell(1, 5, 0));
  });
});

describe('isOnTrack', () => {
  it('is false for a token in base', () => {
    expect(isOnTrack(BASE)).toBe(false);
  });

  it('is true at the entry cell', () => {
    expect(isOnTrack(0)).toBe(true);
  });

  it('is true at the last track cell', () => {
    expect(isOnTrack(TRACK_LENGTH - 1)).toBe(true);
  });

  it('is false once in the home column', () => {
    expect(isOnTrack(HOME_COLUMN_START)).toBe(false);
  });

  it('is false at home', () => {
    expect(isOnTrack(HOME)).toBe(false);
  });
});
