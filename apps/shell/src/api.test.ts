import { describe, expect, it, vi } from 'vitest';
import type { Fetcher, TableSnapshot } from './api.js';
import { Tables } from './api.js';

const SNAPSHOT: TableSnapshot = {
  code: 'ABCDE',
  gameId: 'ludo',
  seats: 2,
  players: ['Alex'],
  phase: 'lobby',
  finished: false,
  moveCount: 0,
  view: null,
};

/** A fetcher that answers with one canned response and records the call. */
function answering(status: number, payload: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetcher = (url, init) => {
    calls.push({ url, ...(init && { init }) });
    return Promise.resolve(
      new Response(payload === undefined ? '' : JSON.stringify(payload), { status }),
    );
  };
  return { calls, fetcher };
}

function tables(status: number, payload: unknown) {
  const { calls, fetcher } = answering(status, payload);
  return { calls, api: new Tables('https://server.test', fetcher) };
}

function bodyOf(call: { init?: RequestInit }): unknown {
  return JSON.parse(String(call.init?.body));
}

describe('opening a table', () => {
  it('asks the server to open one', async () => {
    const { api, calls } = tables(201, { table: SNAPSHOT });
    await api.open('ludo', 2);

    expect(calls[0]?.url).toBe('https://server.test/api/tables');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(bodyOf(calls[0] ?? {})).toEqual({ game: 'ludo', seats: 2 });
  });

  it('answers with the table', async () => {
    const { api } = tables(201, { table: SNAPSHOT });

    expect(await api.open('ludo', 2)).toEqual({ ok: true, value: SNAPSHOT });
  });

  it('sends the body as JSON, and says so', async () => {
    const { api, calls } = tables(201, { table: SNAPSHOT });
    await api.open('ludo', 2);

    expect(calls[0]?.init?.headers).toEqual({ 'content-type': 'application/json' });
  });
});

describe('joining a table', () => {
  it('sends the name to the table with that code', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.join('ABCDE', 'Marcus');

    expect(calls[0]?.url).toBe('https://server.test/api/tables/ABCDE/players');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(bodyOf(calls[0] ?? {})).toEqual({ name: 'Marcus' });
  });

  it('passes on why the server refused', async () => {
    const { api } = tables(409, { error: 'This table is full.' });

    expect(await api.join('ABCDE', 'Marcus')).toEqual({
      ok: false,
      reason: 'This table is full.',
    });
  });
});

describe('starting a game', () => {
  it('posts to the table, with no body to send', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.start('ABCDE');

    expect(calls[0]?.url).toBe('https://server.test/api/tables/ABCDE/start');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBeUndefined();
  });
});

describe('reading a table', () => {
  it('names the viewer, so the server knows whose board to show', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.read('ABCDE', 'Alex');

    expect(calls[0]?.url).toBe('https://server.test/api/tables/ABCDE?viewer=Alex');
  });

  it('escapes a name that would otherwise break the query', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.read('ABCDE', 'Alex & Mia');

    expect(calls[0]?.url).toBe('https://server.test/api/tables/ABCDE?viewer=Alex%20%26%20Mia');
  });

  it('names no viewer for a spectator', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.read('ABCDE', null);

    expect(calls[0]?.url).toBe('https://server.test/api/tables/ABCDE');
  });

  it('only reads, and sends nothing to be read', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.read('ABCDE', null);

    expect(calls[0]?.init?.method).toBe('GET');
    expect(calls[0]?.init?.body).toBeUndefined();
    expect(calls[0]?.init?.headers).toBeUndefined();
  });
});

describe('playing a move', () => {
  it('sends the player and the move untouched', async () => {
    const { api, calls } = tables(200, { table: SNAPSHOT });
    await api.play('ABCDE', 'Alex', { type: 'move', tokenIndex: 2 });

    expect(calls[0]?.url).toBe('https://server.test/api/tables/ABCDE/moves');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(bodyOf(calls[0] ?? {})).toEqual({
      player: 'Alex',
      move: { type: 'move', tokenIndex: 2 },
    });
  });

  it('reports an illegal move as a refusal, not a crash', async () => {
    const { api } = tables(409, { error: 'It is not your turn.' });

    expect(await api.play('ABCDE', 'Alex', { type: 'roll' })).toEqual({
      ok: false,
      reason: 'It is not your turn.',
    });
  });
});

describe('when things go wrong', () => {
  it('reports a network failure in words a player can act on', async () => {
    const failing: Fetcher = () => Promise.reject(new Error('offline'));
    const api = new Tables('https://server.test', failing);

    const answer = await api.read('ABCDE', null);

    expect(answer).toEqual({ ok: false, reason: expect.stringContaining('connection') });
  });

  it('falls back to the status when the server explains nothing', async () => {
    const { api } = tables(500, {});

    expect(await api.read('ABCDE', null)).toEqual({
      ok: false,
      reason: 'The server answered 500.',
    });
  });

  it('falls back to the status when the body is not JSON at all', async () => {
    const api = new Tables('https://server.test', () =>
      Promise.resolve(new Response('<html>gateway</html>', { status: 502 })),
    );

    expect(await api.read('ABCDE', null)).toEqual({
      ok: false,
      reason: 'The server answered 502.',
    });
  });

  it('ignores an empty explanation and says the status instead', async () => {
    const { api } = tables(503, { error: '' });

    expect(await api.read('ABCDE', null)).toEqual({
      ok: false,
      reason: 'The server answered 503.',
    });
  });

  it('refuses an explanation that is not a sentence', async () => {
    const { api } = tables(409, { error: 42 });

    expect(await api.read('ABCDE', null)).toEqual({
      ok: false,
      reason: 'The server answered 409.',
    });
  });

  it('refuses a success whose body is not JSON, rather than crashing on it', async () => {
    const api = new Tables('https://server.test', () =>
      Promise.resolve(new Response('<html>signed in?</html>', { status: 200 })),
    );

    expect(await api.read('ABCDE', null)).toEqual({
      ok: false,
      reason: expect.stringContaining('without a table'),
    });
  });

  it('refuses a success that carries no table', async () => {
    const { api } = tables(200, { something: 'else' });

    expect(await api.read('ABCDE', null)).toEqual({
      ok: false,
      reason: expect.stringContaining('without a table'),
    });
  });

  it('uses the real fetch when it is given none', () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ table: SNAPSHOT })));

    return new Tables('https://server.test').read('ABCDE', null).then((answer) => {
      expect(spy).toHaveBeenCalledWith('https://server.test/api/tables/ABCDE', { method: 'GET' });
      expect(answer.ok).toBe(true);
      spy.mockRestore();
    });
  });
});
