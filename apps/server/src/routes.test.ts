import { describe, expect, it } from 'vitest';
import { routeFor } from './routes.js';

describe('routeFor', () => {
  it('answers a health check at the root', () => {
    expect(routeFor('GET', '/')).toEqual({ kind: 'health' });
  });

  it('lists the games on offer', () => {
    expect(routeFor('GET', '/api/games')).toEqual({ kind: 'games' });
  });

  it('opens a table', () => {
    expect(routeFor('POST', '/api/tables')).toEqual({ kind: 'openTable' });
  });

  it('joins a table', () => {
    expect(routeFor('POST', '/api/tables/ABCDE/players')).toEqual({
      kind: 'joinTable',
      code: 'ABCDE',
    });
  });

  it('starts a table', () => {
    expect(routeFor('POST', '/api/tables/ABCDE/start')).toEqual({
      kind: 'startTable',
      code: 'ABCDE',
    });
  });

  it('reads a table by its code', () => {
    expect(routeFor('GET', '/api/tables/ABCDE')).toEqual({ kind: 'readTable', code: 'ABCDE' });
  });

  it('says something at a table', () => {
    expect(routeFor('POST', '/api/tables/ABCDE/messages')).toEqual({
      kind: 'sayAtTable',
      code: 'ABCDE',
    });
  });

  it('plays a move at a table', () => {
    expect(routeFor('POST', '/api/tables/ABCDE/moves')).toEqual({
      kind: 'playMove',
      code: 'ABCDE',
    });
  });

  it('accepts a code however it was typed', () => {
    expect(routeFor('GET', '/api/tables/abcde')).toEqual({ kind: 'readTable', code: 'ABCDE' });
  });

  it('tolerates a trailing slash', () => {
    expect(routeFor('POST', '/api/tables/')).toEqual({ kind: 'openTable' });
  });

  describe('turns away', () => {
    it('a method the route does not offer', () => {
      expect(routeFor('DELETE', '/api/tables/ABCDE')).toEqual({ kind: 'unknown' });
    });

    it('posting where only reading is offered', () => {
      expect(routeFor('POST', '/api/tables/ABCDE')).toEqual({ kind: 'unknown' });
    });

    it('reading where only posting is offered', () => {
      expect(routeFor('GET', '/api/tables/ABCDE/moves')).toEqual({ kind: 'unknown' });
    });

    it('reading the seats instead of taking one', () => {
      expect(routeFor('GET', '/api/tables/ABCDE/players')).toEqual({ kind: 'unknown' });
    });

    it('reading the messages, which are served with the table instead', () => {
      expect(routeFor('GET', '/api/tables/ABCDE/messages')).toEqual({ kind: 'unknown' });
    });

    it('reading the start action', () => {
      expect(routeFor('GET', '/api/tables/ABCDE/start')).toEqual({ kind: 'unknown' });
    });

    it('a write to the root', () => {
      expect(routeFor('POST', '/')).toEqual({ kind: 'unknown' });
    });

    it('a write to the game list', () => {
      expect(routeFor('POST', '/api/games')).toEqual({ kind: 'unknown' });
    });

    it('reading the table list, which is not something the server offers', () => {
      expect(routeFor('GET', '/api/tables')).toEqual({ kind: 'unknown' });
    });

    it('a path outside the api', () => {
      expect(routeFor('GET', '/tables/ABCDE')).toEqual({ kind: 'unknown' });
    });

    it('a real api path hidden one segment deeper', () => {
      expect(routeFor('POST', '/v2/tables')).toEqual({ kind: 'unknown' });
    });

    it('a collection it does not have, asked to create something', () => {
      expect(routeFor('POST', '/api/players')).toEqual({ kind: 'unknown' });
    });

    it('a collection it does not have', () => {
      expect(routeFor('GET', '/api/players')).toEqual({ kind: 'unknown' });
    });

    it('a code that is not a code', () => {
      expect(routeFor('GET', '/api/tables/not-a-code')).toEqual({ kind: 'unknown' });
    });

    it('an action a table does not have', () => {
      expect(routeFor('POST', '/api/tables/ABCDE/undo')).toEqual({ kind: 'unknown' });
    });

    it('a path deeper than anything it serves', () => {
      expect(routeFor('POST', '/api/tables/ABCDE/moves/3')).toEqual({ kind: 'unknown' });
    });

    it('the game list with something after it', () => {
      expect(routeFor('GET', '/api/games/ludo')).toEqual({ kind: 'unknown' });
    });
  });
});
