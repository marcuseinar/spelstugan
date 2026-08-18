import { describe, expect, it } from 'vitest';
import { BASE, HOME, HOME_COLUMN_START, TRACK_LENGTH, startCellForSeat } from './board.js';
import { canMoveToken, capturesAt, destinationFor, hasWon, legalTokenIndices } from './moves.js';
import { position } from './testing.js';

describe('destinationFor', () => {
  // MC/DC: three conditions decide this — already home, still in base, and
  // overshooting home. Each group below flips one while holding the rest.

  describe('condition: the token is already home', () => {
    it('refuses to move a token that is home', () => {
      expect(destinationFor(HOME, 3)).toBeNull();
    });

    it('moves an otherwise identical token that is not home', () => {
      expect(destinationFor(HOME - 1, 1)).toBe(HOME);
    });
  });

  describe('condition: the token is in base', () => {
    it('releases a token from base only on a six', () => {
      expect(destinationFor(BASE, 6)).toBe(0);
    });

    it.each([1, 2, 3, 4, 5])('keeps a token in base on a %i', (roll) => {
      expect(destinationFor(BASE, roll)).toBeNull();
    });

    it('moves a token already on the track with the same non-six roll', () => {
      expect(destinationFor(10, 3)).toBe(13);
    });
  });

  describe('condition: the roll overshoots home', () => {
    it('refuses a roll that would pass home', () => {
      expect(destinationFor(HOME - 2, 3)).toBeNull();
    });

    it('accepts the exact roll that reaches home', () => {
      expect(destinationFor(HOME - 2, 2)).toBe(HOME);
    });

    it('accepts a roll that stops short of home', () => {
      expect(destinationFor(HOME - 4, 2)).toBe(HOME - 2);
    });
  });

  it('carries a token from the track into the home column', () => {
    expect(destinationFor(HOME_COLUMN_START - 1, 2)).toBe(HOME_COLUMN_START + 1);
  });
});

describe('canMoveToken', () => {
  // MC/DC: legality is "the roll reaches somewhere" AND "your own token is not
  // already there". Each pair below flips one of those.

  it('allows a move when the roll reaches and the square is free', () => {
    const shared = position({ tokens: [[5]] });

    expect(canMoveToken(shared, 0, 0, 3)).toBe(true);
  });

  it('refuses when the roll cannot be spent, even though the square is free', () => {
    const shared = position({ tokens: [[BASE]] });

    expect(canMoveToken(shared, 0, 0, 3)).toBe(false);
  });

  it('refuses when the roll reaches but the seat’s own token is already there', () => {
    const shared = position({ tokens: [[5, 8]] });

    expect(canMoveToken(shared, 0, 0, 3)).toBe(false);
  });

  it('allows stacking beyond the shared track, where tokens cannot collide', () => {
    const shared = position({ tokens: [[HOME_COLUMN_START, HOME_COLUMN_START + 2]] });

    expect(canMoveToken(shared, 0, 0, 2)).toBe(true);
  });

  it('refuses an out-of-range token index', () => {
    const shared = position({ tokens: [[5]] });

    expect(canMoveToken(shared, 0, 99, 3)).toBe(false);
  });

  it('refuses an out-of-range seat index', () => {
    const shared = position({ tokens: [[5]] });

    expect(canMoveToken(shared, 9, 0, 3)).toBe(false);
  });
});

describe('legalTokenIndices', () => {
  it('lists only the tokens a roll can be spent on', () => {
    const shared = position({ tokens: [[BASE, 10, HOME]] });

    expect(legalTokenIndices(shared, 0, 3)).toEqual([1]);
  });

  it('includes tokens in base when a six is rolled', () => {
    // Tokens 2 and 3 default to base, so a six releases any of the three.
    const shared = position({ tokens: [[BASE, 10]] });

    expect(legalTokenIndices(shared, 0, 6)).toEqual([0, 1, 2, 3]);
  });

  it('is empty when nothing can move', () => {
    const shared = position({ tokens: [[BASE, BASE, BASE, BASE]] });

    expect(legalTokenIndices(shared, 0, 3)).toEqual([]);
  });

  it('is empty for an unknown seat', () => {
    expect(legalTokenIndices(position({ tokens: [[5]] }), 7, 3)).toEqual([]);
  });
});

describe('capturesAt', () => {
  // Seat 1 starts 13 cells around from seat 0, so seat 0 at progress 13 shares
  // a cell with seat 1 at progress 0.
  const seatOneStart = startCellForSeat(1);

  it('captures an opponent sharing the destination cell', () => {
    const shared = position({ tokens: [[10], [1]] });
    const captures = capturesAt(shared, 0, seatOneStart + 1);

    expect(captures).toEqual([{ seatIndex: 1, tokenIndex: 0 }]);
  });

  it('captures every opponent token on that cell', () => {
    const shared = position({ tokens: [[10], [1], [1 + TRACK_LENGTH - startCellForSeat(2) + 1]] });
    const captures = capturesAt(shared, 0, seatOneStart + 1);

    expect(captures.length).toBeGreaterThanOrEqual(1);
    expect(captures.every((capture) => capture.seatIndex !== 0)).toBe(true);
  });

  it('never captures on a safe cell', () => {
    const shared = position({ tokens: [[10], [0]] });

    expect(capturesAt(shared, 0, seatOneStart)).toEqual([]);
  });

  it('never captures the mover’s own tokens', () => {
    const shared = position({ tokens: [[10, 14]] });

    expect(capturesAt(shared, 0, 14)).toEqual([]);
  });

  it('captures nothing in the home column, which is off the shared track', () => {
    const shared = position({ tokens: [[HOME_COLUMN_START], [HOME_COLUMN_START]] });

    expect(capturesAt(shared, 0, HOME_COLUMN_START + 1)).toEqual([]);
  });

  it('captures nothing when no opponent is there', () => {
    const shared = position({ tokens: [[10], [40]] });

    expect(capturesAt(shared, 0, 14)).toEqual([]);
  });
});

describe('hasWon', () => {
  it('is true only when every token is home', () => {
    expect(hasWon({ playerId: 'p', tokens: [HOME, HOME, HOME, HOME] })).toBe(true);
  });

  it('is false while any token is short of home', () => {
    expect(hasWon({ playerId: 'p', tokens: [HOME, HOME, HOME, HOME - 1] })).toBe(false);
  });
});
