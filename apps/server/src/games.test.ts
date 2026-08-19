import { ludo } from '@spelstugan/ludo';
import { describe, expect, it } from 'vitest';
import { gameIds, gameNamed, seatingProblem } from './games.js';

describe('the game registry', () => {
  it('finds a game by the id it declares', () => {
    expect(gameNamed(ludo.id)).toBe(ludo);
  });

  it('has nothing for a game it does not carry', () => {
    expect(gameNamed('chess')).toBeUndefined();
  });

  it('is empty-handed rather than surprising about an empty id', () => {
    expect(gameNamed('')).toBeUndefined();
  });

  it('lists what it can seat', () => {
    expect(gameIds()).toContain(ludo.id);
  });
});

describe('seatingProblem', () => {
  it('is content with the fewest players a game allows', () => {
    expect(seatingProblem(ludo, ludo.minPlayers)).toBeNull();
  });

  it('is content with the most players a game allows', () => {
    expect(seatingProblem(ludo, ludo.maxPlayers)).toBeNull();
  });

  it('complains about one player too few', () => {
    expect(seatingProblem(ludo, ludo.minPlayers - 1)).toContain('at least');
  });

  it('complains about one player too many', () => {
    expect(seatingProblem(ludo, ludo.maxPlayers + 1)).toContain('at most');
  });

  it('names the game it is complaining about', () => {
    expect(seatingProblem(ludo, 0)).toContain(ludo.name);
  });
});
