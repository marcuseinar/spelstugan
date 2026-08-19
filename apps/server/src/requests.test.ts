import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_LENGTH,
  parseJoinRequest,
  parseMoveRequest,
  parseTableRequest,
} from './requests.js';

const name = (length: number) => 'a'.repeat(length);

/**
 * The sentence a refusal carries.
 *
 * Asserting on it rather than only on `ok` is what makes each refusal
 * distinguishable: a client shows this to a person, so "rejected" is not
 * enough — it has to be rejected for the reason the caller can act on.
 */
function refusal(result: { ok: boolean; reason?: string }): string {
  if (result.ok) {
    throw new Error('Expected the request to be refused.');
  }
  return result.reason ?? '';
}

describe('parseTableRequest', () => {
  it('accepts a game and a number of seats', () => {
    expect(parseTableRequest({ game: 'ludo', seats: 2 })).toEqual({
      ok: true,
      value: { gameId: 'ludo', seats: 2 },
    });
  });

  it('accepts a seat count the game will later refuse, since that is its call', () => {
    expect(parseTableRequest({ game: 'ludo', seats: 99 }).ok).toBe(true);
  });

  it('accepts zero seats, for the same reason', () => {
    expect(parseTableRequest({ game: 'ludo', seats: 0 }).ok).toBe(true);
  });

  describe('refuses', () => {
    it('a body that is not an object', () => {
      expect(refusal(parseTableRequest('ludo'))).toMatch(/JSON object/);
    });

    it('a body that is an array', () => {
      expect(refusal(parseTableRequest([]))).toMatch(/JSON object/);
    });

    it('a null body', () => {
      expect(refusal(parseTableRequest(null))).toMatch(/JSON object/);
    });

    it('a missing game', () => {
      expect(refusal(parseTableRequest({ seats: 2 }))).toMatch(/game/);
    });

    it('an empty game name', () => {
      expect(refusal(parseTableRequest({ game: '', seats: 2 }))).toMatch(/game/);
    });

    it('a game name that is not a string', () => {
      expect(refusal(parseTableRequest({ game: 7, seats: 2 }))).toMatch(/game/);
    });

    it('a missing seat count', () => {
      expect(refusal(parseTableRequest({ game: 'ludo' }))).toMatch(/seats/);
    });

    it('a seat count that is not a number', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', seats: 'two' }))).toMatch(/seats/);
    });

    it('half a seat', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', seats: 2.5 }))).toMatch(/seats/);
    });
  });
});

describe('parseJoinRequest', () => {
  it('accepts a name', () => {
    expect(parseJoinRequest({ name: 'Marcus' })).toEqual({
      ok: true,
      value: { name: 'Marcus' },
    });
  });

  it('accepts a name of the greatest allowed length', () => {
    expect(parseJoinRequest({ name: name(MAX_NAME_LENGTH) }).ok).toBe(true);
  });

  describe('refuses', () => {
    it('a body that is not an object', () => {
      expect(refusal(parseJoinRequest('Marcus'))).toMatch(/JSON object/);
    });

    it('a null body', () => {
      expect(refusal(parseJoinRequest(null))).toMatch(/JSON object/);
    });

    it('a missing name', () => {
      expect(refusal(parseJoinRequest({}))).toMatch(/name/);
    });

    it('an empty name', () => {
      expect(refusal(parseJoinRequest({ name: '' }))).toMatch(/name/);
    });

    it('a name that is not a string', () => {
      expect(refusal(parseJoinRequest({ name: 42 }))).toMatch(/name/);
    });

    it('a name one character too long', () => {
      expect(refusal(parseJoinRequest({ name: name(MAX_NAME_LENGTH + 1) }))).toMatch(/name/);
    });
  });
});

describe('parseMoveRequest', () => {
  it('accepts a player and a move', () => {
    expect(parseMoveRequest({ player: 'Alex', move: { type: 'roll' } })).toEqual({
      ok: true,
      value: { player: 'Alex', move: { type: 'roll' } },
    });
  });

  it('passes the move through untouched, since only the game understands it', () => {
    const move = { type: 'move', tokenIndex: 2, nested: { deep: true } };

    expect(parseMoveRequest({ player: 'Alex', move })).toEqual({
      ok: true,
      value: { player: 'Alex', move },
    });
  });

  it('accepts a move that is not an object', () => {
    expect(parseMoveRequest({ player: 'Alex', move: 'pass' }).ok).toBe(true);
  });

  it('accepts a move of null, which is a value a game may use', () => {
    expect(parseMoveRequest({ player: 'Alex', move: null }).ok).toBe(true);
  });

  describe('refuses', () => {
    it('a body that is not an object', () => {
      expect(refusal(parseMoveRequest(42))).toMatch(/JSON object/);
    });

    it('a missing player', () => {
      expect(refusal(parseMoveRequest({ move: { type: 'roll' } }))).toMatch(/player/);
    });

    it('an empty player name', () => {
      expect(refusal(parseMoveRequest({ player: '', move: { type: 'roll' } }))).toMatch(/player/);
    });

    it('a player name that is not a string', () => {
      expect(refusal(parseMoveRequest({ player: ['Alex'], move: { type: 'roll' } }))).toMatch(
        /player/,
      );
    });

    it('a player name one character too long', () => {
      expect(refusal(parseMoveRequest({ player: name(MAX_NAME_LENGTH + 1), move: 1 }))).toMatch(
        /player/,
      );
    });

    it('a null body, which would otherwise be read as an object', () => {
      expect(refusal(parseMoveRequest(null))).toMatch(/JSON object/);
    });

    it('a missing move', () => {
      expect(refusal(parseMoveRequest({ player: 'Alex' }))).toMatch(/move/);
    });
  });
});
