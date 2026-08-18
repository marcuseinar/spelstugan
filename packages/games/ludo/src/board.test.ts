import { describe, expect, it } from 'vitest';
import {
  BASE,
  HOME,
  HOME_COLUMN_START,
  SEATS,
  TRACK_END,
  TRACK_LENGTH,
  TRACK_START,
  isHome,
  isInBase,
  isInHomeColumn,
  isSafeCell,
  startCellForSeat,
  trackCell,
} from './board.js';

describe('startCellForSeat', () => {
  it('spaces the seats evenly around the track', () => {
    const starts = Array.from({ length: SEATS }, (_, seat) => startCellForSeat(seat));

    expect(starts).toEqual([0, 13, 26, 39]);
  });
});

describe('trackCell', () => {
  it('places a seat’s first step on its own start cell', () => {
    expect(trackCell(1, TRACK_START)).toBe(startCellForSeat(1));
  });

  it('advances one cell per step of progress', () => {
    expect(trackCell(0, 5)).toBe(5);
  });

  it('wraps around the end of the track', () => {
    expect(trackCell(3, 20)).toBe((39 + 20) % TRACK_LENGTH);
  });

  it('places the last track step correctly', () => {
    expect(trackCell(0, TRACK_END)).toBe(TRACK_END);
  });

  it('reports no cell for a token in base', () => {
    expect(trackCell(0, BASE)).toBeNull();
  });

  it('reports no cell once a token enters the home column', () => {
    expect(trackCell(0, HOME_COLUMN_START)).toBeNull();
  });

  it('reports no cell for a token that is home', () => {
    expect(trackCell(0, HOME)).toBeNull();
  });

  it('lets two seats meet on the same cell from different progress', () => {
    expect(trackCell(0, 13)).toBe(trackCell(1, 0));
  });
});

describe('isSafeCell', () => {
  it('treats every seat’s start cell as safe', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      expect(isSafeCell(startCellForSeat(seat))).toBe(true);
    }
  });

  it('treats the star cell past each start as safe', () => {
    for (let seat = 0; seat < SEATS; seat += 1) {
      expect(isSafeCell((startCellForSeat(seat) + 8) % TRACK_LENGTH)).toBe(true);
    }
  });

  it('treats an ordinary cell as unsafe', () => {
    expect(isSafeCell(5)).toBe(false);
  });

  it('marks exactly two safe cells per seat', () => {
    const safe = Array.from({ length: TRACK_LENGTH }, (_, cell) => cell).filter(isSafeCell);

    expect(safe).toHaveLength(SEATS * 2);
  });
});

describe('isInBase', () => {
  it('is true only for a token in base', () => {
    expect(isInBase(BASE)).toBe(true);
  });

  it('is false for a token on the track', () => {
    expect(isInBase(TRACK_START)).toBe(false);
  });
});

describe('isHome', () => {
  it('is true only at home', () => {
    expect(isHome(HOME)).toBe(true);
  });

  it('is false one step short of home', () => {
    expect(isHome(HOME - 1)).toBe(false);
  });
});

describe('isInHomeColumn', () => {
  it('is true at the first home-column square', () => {
    expect(isInHomeColumn(HOME_COLUMN_START)).toBe(true);
  });

  it('is true at the last square before home', () => {
    expect(isInHomeColumn(HOME - 1)).toBe(true);
  });

  it('is false on the last track square, just before the column', () => {
    expect(isInHomeColumn(HOME_COLUMN_START - 1)).toBe(false);
  });

  it('is false at home, which is past the column', () => {
    expect(isInHomeColumn(HOME)).toBe(false);
  });

  it('is false in base', () => {
    expect(isInHomeColumn(BASE)).toBe(false);
  });
});
