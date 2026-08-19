/**
 * Plays a whole game of Ludo against a running server.
 *
 * The Worker and the Durable Object hold no decisions — those live in pure,
 * mutated modules — but they do hold storage and dispatch, and the only honest
 * way to know those work is to use them. This is that check: seat a table,
 * play until someone wins, read the log back, and try every way of asking
 * wrongly.
 *
 *   npm run test:e2e --workspace @spelstugan/server
 *   BASE=https://spelstugan.<subdomain>.workers.dev npm run test:e2e ...
 *
 * It is not part of `npm run check`: it needs a server, and `check` must run
 * without one.
 */

const base = process.env.BASE ?? 'http://127.0.0.1:8787';

const call = async (path, init) => {
  const response = await fetch(`${base}${path}`, init);
  return { status: response.status, body: await response.json() };
};
const post = (path, payload) =>
  call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed, detail });

const opened = await post('/api/tables', { game: 'ludo', seats: 2 });
check(
  'opens a table',
  opened.status === 201 && /^[A-Z2-9]{5}$/.test(opened.body.table.code),
  opened,
);
const code = opened.body.table.code;

check('opens it into a lobby', opened.body.table.phase === 'lobby', opened.body.table);
check('opens it with nobody seated', opened.body.table.players.length === 0, opened.body.table);
check(
  'refuses to start with nobody seated',
  (await post(`/api/tables/${code}/start`)).status === 409,
);

const firstSeat = await post(`/api/tables/${code}/players`, { name: 'Alex' });
check(
  'seats the first player',
  firstSeat.status === 200 && firstSeat.body.table.players[0] === 'Alex',
  firstSeat.body,
);
check(
  'refuses a second player of the same name',
  (await post(`/api/tables/${code}/players`, { name: 'Alex' })).status === 409,
);
check(
  'refuses a move before the game starts',
  (await post(`/api/tables/${code}/moves`, { player: 'Alex', move: { type: 'roll' } })).status ===
    409,
);

const secondSeat = await post(`/api/tables/${code}/players`, { name: 'Mia' });
check(
  'seats a second player',
  secondSeat.status === 200 && secondSeat.body.table.players.length === 2,
  secondSeat.body,
);
check(
  'shows no board while still in the lobby',
  secondSeat.body.table.view === null,
  secondSeat.body.table,
);
check(
  'refuses a third player at a two-seat table',
  (await post(`/api/tables/${code}/players`, { name: 'Priya' })).status === 409,
);

const started = await post(`/api/tables/${code}/start`);
check(
  'starts the game',
  started.status === 200 && started.body.table.phase === 'playing',
  started.body,
);
check(
  'deals a board on starting',
  started.body.table.view?.shared !== undefined,
  started.body.table,
);
check('refuses to start twice', (await post(`/api/tables/${code}/start`)).status === 409);
check(
  'refuses a latecomer once started',
  (await post(`/api/tables/${code}/players`, { name: 'Late' })).status === 409,
);

// Play until someone wins, or we run out of patience.
let moves = 0;
let finished = false;
let lastTable = null;
let lastPlayed = null;
const players = ['Alex', 'Mia'];
let rejections = 0;

for (let step = 0; step < 4000 && !finished; step += 1) {
  const seen = await call(`/api/tables/${code}?viewer=Alex`);
  lastTable = seen.body.table;
  const shared = lastTable.view.shared;
  const mover = players[shared.currentSeat];

  if (shared.phase === 'roll') {
    const played = await post(`/api/tables/${code}/moves`, {
      player: mover,
      move: { type: 'roll' },
    });
    if (played.status !== 200) {
      check('roll accepted', false, played);
      break;
    }
    moves += 1;
    lastPlayed = played.body.table;
    finished = played.body.table.finished;
    continue;
  }

  let moved = false;
  for (let token = 0; token < 4 && !moved; token += 1) {
    const played = await post(`/api/tables/${code}/moves`, {
      player: mover,
      move: { type: 'move', tokenIndex: token },
    });
    if (played.status === 200) {
      moved = true;
      moves += 1;
      lastPlayed = played.body.table;
      finished = played.body.table.finished;
    } else if (played.status === 409) {
      rejections += 1;
    } else {
      check('move rejected cleanly', false, played);
      moved = true;
    }
  }
  if (!moved) {
    check('found a legal move', false, shared);
    break;
  }
}

check('plays a full game to a winner', finished, { moves, finished });
check('counts every accepted move', lastPlayed?.moveCount === moves, {
  counted: lastPlayed?.moveCount,
  moves,
});
check('reads back what the last move returned', lastTable !== null);
check('rejects illegal moves without applying them', rejections > 0, { rejections });

const reread = await call(`/api/tables/${code}`);
check(
  'serves a spectator the finished table',
  reread.status === 200 && reread.body.table.finished === true,
  reread.body.table?.moveCount,
);
check(
  'spectator sees no private state',
  reread.body.table.view.own === undefined,
  reread.body.table.view,
);
check('the log survived the whole game', reread.body.table.moveCount === moves, {
  stored: reread.body.table.moveCount,
  moves,
});

const winner = reread.body.table.view.shared.winner;
check('records a winner', winner === 'Alex' || winner === 'Mia', winner);

// Failure modes.
check('unknown code is 404', (await call('/api/tables/ZZZZZ')).status === 404);
check('malformed code is 404', (await call('/api/tables/nope')).status === 404);
check(
  'unseated player is refused',
  (await post(`/api/tables/${code}/moves`, { player: 'Nobody', move: { type: 'roll' } })).status ===
    409,
);
check(
  'a finished game refuses more moves',
  (await post(`/api/tables/${code}/moves`, { player: 'Alex', move: { type: 'roll' } })).status ===
    409,
);
check(
  'bad JSON is 400',
  (await call(`/api/tables/${code}/moves`, { method: 'POST', body: 'not json' })).status === 400,
);
check(
  'missing player is 400',
  (await post(`/api/tables/${code}/moves`, { move: { type: 'roll' } })).status === 400,
);
check(
  'unknown game is 404',
  (await post('/api/tables', { game: 'chess', seats: 2 })).status === 404,
);
check(
  'one seat is too few for ludo',
  (await post('/api/tables', { game: 'ludo', seats: 1 })).status === 400,
);
check(
  'five seats is too many for ludo',
  (await post('/api/tables', { game: 'ludo', seats: 5 })).status === 400,
);
check(
  'a table with no seat count is 400',
  (await post('/api/tables', { game: 'ludo' })).status === 400,
);
check('unknown endpoint is 404', (await call('/api/nothing')).status === 404);
check(
  'CORS preflight is allowed',
  (await fetch(`${base}/api/tables`, { method: 'OPTIONS' })).status === 204,
);

const failed = checks.filter((c) => !c.passed);
for (const result of checks) {
  const mark = result.passed ? 'ok  ' : 'FAIL';
  const detail = result.passed ? '' : ` — ${JSON.stringify(result.detail)}`;
  console.log(`${mark} ${result.name}${detail}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed, ${moves} moves played`);
process.exit(failed.length === 0 ? 0 : 1);
