/**
 * The Spelstugan server.
 *
 * It owns tables, not rules: a request is validated, routed to the Durable
 * Object that holds the table, and answered with what that table now looks
 * like. Every rule decision belongs to a game plugin, and every durable fact
 * is a move in a log.
 */

import { createRng } from '@spelstugan/game-kit';
import { createCode } from './codes.js';
import { gameIds, gameNamed, seatingProblem } from './games.js';
import { asJson } from './json.js';
import { parseMoveRequest, parseTableRequest } from './requests.js';
import { routeFor } from './routes.js';
import type { GameTable, TableAnswer, TableCommand } from './table.js';

export { GameTable } from './table.js';

export interface Env {
  readonly GAME_TABLE: DurableObjectNamespace<GameTable>;
}

/**
 * Open to any origin for now.
 *
 * The demo is served from github.io and the API from workers.dev, so they are
 * cross-origin by construction. Nothing here is authenticated yet — knowing a
 * room code is the whole of the authorization story (decision 015) — so there
 * is no cookie or token for a permissive origin to leak. Narrow this the day
 * sessions exist.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
} as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const route = routeFor(request.method, url.pathname);

    switch (route.kind) {
      case 'health':
        return json({ service: 'spelstugan', status: 'ok' });
      case 'games':
        return json({ games: gameIds() });
      case 'createTable':
        return await createTable(request, env);
      case 'readTable':
        return await readTable(route.code, url.searchParams.get('viewer'), env);
      case 'playMove':
        return await playMove(route.code, request, env);
      case 'unknown':
        return problem(404, 'No such endpoint.');
    }
  },
};

/** How many codes to try before admitting the room is not the problem. */
const CODE_ATTEMPTS = 5;

async function createTable(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return problem(400, body.reason);
  }

  const parsed = parseTableRequest(body.value);
  if (!parsed.ok) {
    return problem(400, parsed.reason);
  }

  const game = gameNamed(parsed.value.gameId);
  if (game === undefined) {
    return problem(404, `This server does not have a game called "${parsed.value.gameId}".`);
  }

  const problemSeating = seatingProblem(game, parsed.value.players.length);
  if (problemSeating !== null) {
    return problem(400, problemSeating);
  }

  const record = {
    gameId: game.id,
    seed: crypto.randomUUID(),
    players: parsed.value.players,
  };

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = createCode(createRng(crypto.randomUUID()));
    const answer = await ask(env, code, { kind: 'seat', record });
    if (answer.outcome === 'seated') {
      return json({ code, game: game.id, players: record.players }, 201);
    }
  }
  return problem(503, 'Could not find a free room code. Try again.');
}

async function readTable(code: string, viewer: string | null, env: Env): Promise<Response> {
  const answer = await ask(env, code, { kind: 'read', code, viewer });
  return answer.outcome === 'table' ? json({ table: answer.table }) : noSuchTable();
}

async function playMove(code: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return problem(400, body.reason);
  }

  const parsed = parseMoveRequest(body.value);
  if (!parsed.ok) {
    return problem(400, parsed.reason);
  }

  const answer = await ask(env, code, {
    kind: 'play',
    code,
    player: parsed.value.player,
    move: asJson(parsed.value.move),
  });

  switch (answer.outcome) {
    case 'played':
      return json({ events: answer.events, table: answer.table });
    case 'refused':
      // The move was understood and refused: that is the rules working, not a
      // malformed request, so it is a conflict rather than a bad one.
      return problem(409, answer.reason);
    default:
      return noSuchTable();
  }
}

function noSuchTable(): Response {
  return problem(404, 'No table with that code.');
}

/** Asks the table at this code. Codes name tables; that is the whole lookup. */
async function ask(env: Env, code: string, command: TableCommand): Promise<TableAnswer> {
  const table = env.GAME_TABLE.get(env.GAME_TABLE.idFromName(code));
  const response = await table.fetch('https://table.spelstugan/', {
    method: 'POST',
    body: JSON.stringify(command),
  });
  return (await response.json()) as TableAnswer;
}

async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, reason: 'The body is not valid JSON.' };
  }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

function problem(status: number, reason: string): Response {
  return json({ error: reason }, status);
}
