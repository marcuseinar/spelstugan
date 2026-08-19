import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, parseMoveRequest, parseTableRequest } from './requests.js';

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
  it('accepts a game and its players', () => {
    expect(parseTableRequest({ game: 'ludo', players: ['Alex', 'Mia'] })).toEqual({
      ok: true,
      value: { gameId: 'ludo', players: ['Alex', 'Mia'] },
    });
  });

  it('accepts a single player, since seat counts are the game’s business', () => {
    expect(parseTableRequest({ game: 'solo', players: ['Alex'] }).ok).toBe(true);
  });

  it('accepts a name of the greatest allowed length', () => {
    expect(parseTableRequest({ game: 'ludo', players: [name(MAX_NAME_LENGTH)] }).ok).toBe(true);
  });

  it('accepts the most players a table seats', () => {
    const players = Array.from({ length: 8 }, (_, index) => `Player ${index}`);

    expect(parseTableRequest({ game: 'ludo', players }).ok).toBe(true);
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
      expect(refusal(parseTableRequest({ players: ['Alex'] }))).toMatch(/game/);
    });

    it('an empty game name', () => {
      expect(refusal(parseTableRequest({ game: '', players: ['Alex'] }))).toMatch(/game/);
    });

    it('a game name that is not a string', () => {
      expect(refusal(parseTableRequest({ game: 7, players: ['Alex'] }))).toMatch(/game/);
    });

    it('missing players', () => {
      expect(refusal(parseTableRequest({ game: 'ludo' }))).toMatch(/player/);
    });

    it('an empty table', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', players: [] }))).toMatch(
        /at least one player/,
      );
    });

    it('players that are not a list', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', players: 'Alex' }))).toMatch(/player/);
    });

    it('one player too many', () => {
      const players = Array.from({ length: 9 }, (_, index) => `Player ${index}`);

      expect(refusal(parseTableRequest({ game: 'ludo', players }))).toMatch(/at most 8/);
    });

    it('an empty name', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', players: ['Alex', ''] }))).toMatch(/name/);
    });

    it('a name one character too long', () => {
      expect(
        refusal(parseTableRequest({ game: 'ludo', players: [name(MAX_NAME_LENGTH + 1)] })),
      ).toMatch(/name/);
    });

    it('a name that is not a string', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', players: ['Alex', 3] }))).toMatch(/name/);
    });

    it('two players sharing a name, who could not tell their moves apart', () => {
      expect(refusal(parseTableRequest({ game: 'ludo', players: ['Alex', 'Alex'] }))).toMatch(
        /share a name/,
      );
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
