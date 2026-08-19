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
import type { Env } from './env.js';
import { gameIds, gameNamed, seatingProblem } from './games.js';
import { asJson } from './json.js';
import {
  parseJoinRequest,
  parseMessageRequest,
  parseMoveRequest,
  parseTableRequest,
} from './requests.js';
import { routeFor } from './routes.js';
import type { TableAnswer, TableCommand } from './table.js';

export { GameTable } from './table.js';
export type { Env } from './env.js';

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
        return await health(env);
      case 'games':
        return json({ games: gameIds() });
      case 'openTable':
        return await openTable(request, env);
      case 'readTable':
        return await readTable(route.code, url.searchParams.get('viewer'), env);
      case 'joinTable':
        return await joinTable(route.code, request, env);
      case 'startTable':
        return await answerWith(env, route.code, { kind: 'start', code: route.code });
      case 'playMove':
        return await playMove(route.code, request, env);
      case 'sayAtTable':
        return await sayAtTable(route.code, request, env);
      case 'unknown':
        return problem(404, 'No such endpoint.');
    }
  },
};

/**
 * What is running, in front and behind.
 *
 * A table is asked as well as the Worker, under a name nobody has used, so the
 * answer comes from an object started just now. A Durable Object keeps running
 * the script it started with, so the Worker can be new while tables are not —
 * which is a deploy half-live, and worth waiting out rather than testing.
 */
async function health(env: Env): Promise<Response> {
  const fresh = await ask(env, crypto.randomUUID(), { kind: 'version' });
  return json({
    service: 'spelstugan',
    status: 'ok',
    build: env.BUILD ?? 'unknown',
    tableBuild: fresh.outcome === 'version' ? fresh.build : 'unknown',
  });
}

/** How many codes to try before admitting the room is not the problem. */
const CODE_ATTEMPTS = 5;

async function openTable(request: Request, env: Env): Promise<Response> {
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

  const tooManyOrFew = seatingProblem(game, parsed.value.seats);
  if (tooManyOrFew !== null) {
    return problem(400, tooManyOrFew);
  }

  const record = { gameId: game.id, seed: crypto.randomUUID(), seats: parsed.value.seats };

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = createCode(createRng(crypto.randomUUID()));
    const answer = await ask(env, code, { kind: 'open', code, record });
    if (answer.outcome === 'table') {
      return json({ table: answer.table }, 201);
    }
  }
  return problem(503, 'Could not find a free room code. Try again.');
}

async function joinTable(code: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return problem(400, body.reason);
  }

  const parsed = parseJoinRequest(body.value);
  if (!parsed.ok) {
    return problem(400, parsed.reason);
  }
  return await answerWith(env, code, { kind: 'join', code, name: parsed.value.name });
}

async function sayAtTable(code: string, request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) {
    return problem(400, body.reason);
  }

  const parsed = parseMessageRequest(body.value);
  if (!parsed.ok) {
    return problem(400, parsed.reason);
  }
  return await answerWith(env, code, {
    kind: 'say',
    code,
    author: parsed.value.author,
    text: parsed.value.text,
  });
}

async function readTable(code: string, viewer: string | null, env: Env): Promise<Response> {
  return await answerWith(env, code, { kind: 'read', code, viewer });
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

  return answer.outcome === 'played'
    ? json({ events: answer.events, table: answer.table })
    : httpFor(answer);
}

/** Runs a command whose only successful answer is the table itself. */
async function answerWith(env: Env, code: string, command: TableCommand): Promise<Response> {
  const answer = await ask(env, code, command);
  return answer.outcome === 'table' ? json({ table: answer.table }) : httpFor(answer);
}

/**
 * The one place a table's outcome becomes a status code.
 *
 * A refusal is the rules or the lobby working as intended, so it is a
 * conflict rather than a malformed request — the client sent something
 * understandable that this table will not do right now.
 */
function httpFor(answer: TableAnswer): Response {
  switch (answer.outcome) {
    case 'refused':
      return problem(409, answer.reason);
    case 'code-taken':
      return problem(409, 'That code is taken.');
    default:
      return problem(404, 'No table with that code.');
  }
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
