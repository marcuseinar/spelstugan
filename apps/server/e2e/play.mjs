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

/**
 * Records a check and says so immediately.
 *
 * Printing as it goes rather than at the end matters: when this script met a
 * shape it did not expect it died silently, and a CI log that ends in a stack
 * trace with no history is a log that has to be re-run to learn anything.
 */
function check(name, passed, detail) {
  checks.push({ name, passed, detail });
  const mark = passed ? 'ok  ' : 'FAIL';
  const because = passed ? '' : ` — ${JSON.stringify(detail)}`;
  console.log(`${mark} ${name}${because}`);
}

/** The table in a response, or a placeholder that reports rather than throws. */
const tableIn = (response) =>
  response.body?.table ?? {
    players: [],
    messages: [],
    view: null,
    moveCount: -1,
    finished: false,
    phase: '?',
  };

/**
 * Waits until the server answering is the one that was just deployed.
 *
 * A deploy is not instant everywhere, and testing the version it replaced
 * looks exactly like a bug in the version it did not. Skipped when nothing
 * said which build to expect, as when running against a local Worker.
 */
async function waitForBuild(expected) {
  if (!expected) {
    return;
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = await call('/');
    // Both, because a table can still be running the version the Worker in
    // front of it has already replaced.
    if (health.body?.build === expected && health.body?.tableBuild === expected) {
      check(`the deployed build is the one under test (${expected.slice(0, 7)})`, true);
      return;
    }
    await new Promise((wake) => setTimeout(wake, 2000));
  }
  check('the deployed build is the one under test', false, { expected });
  process.exit(1);
}

await waitForBuild(process.env.EXPECT_BUILD);

const opened = await post('/api/tables', { game: 'ludo', seats: 2 });
check('opens a table', opened.status === 201 && /^[A-Z2-9]{5}$/.test(tableIn(opened).code), opened);
const code = tableIn(opened).code;

check('opens it into a lobby', tableIn(opened).phase === 'lobby', tableIn(opened));
check('opens it with nobody seated', tableIn(opened).players.length === 0, tableIn(opened));
check(
  'refuses to start with nobody seated',
  (await post(`/api/tables/${code}/start`)).status === 409,
);

const firstSeat = await post(`/api/tables/${code}/players`, { name: 'Alex' });
check(
  'seats the first player',
  firstSeat.status === 200 && tableIn(firstSeat).players[0] === 'Alex',
  firstSeat.body,
);
const again = await post(`/api/tables/${code}/players`, { name: 'Alex' });
check('lets a player back into the seat they already have', again.status === 200, again.body);
check('without seating them twice', tableIn(again).players.length === 1, tableIn(again).players);
check(
  'refuses a move before the game starts',
  (await post(`/api/tables/${code}/moves`, { player: 'Alex', move: { type: 'roll' } })).status ===
    409,
);

const secondSeat = await post(`/api/tables/${code}/players`, { name: 'Mia' });
check(
  'seats a second player',
  secondSeat.status === 200 && tableIn(secondSeat).players.length === 2,
  secondSeat.body,
);
check(
  'shows no board while still in the lobby',
  tableIn(secondSeat).view === null,
  tableIn(secondSeat),
);
check(
  'refuses a third player at a two-seat table',
  (await post(`/api/tables/${code}/players`, { name: 'Priya' })).status === 409,
);

// The conversation is the product; it had better work before the game does.
check(
  'notes who sat down',
  tableIn(secondSeat).messages.filter((line) => line.kind === 'joined').length === 2,
  tableIn(secondSeat).messages,
);
const said = await post(`/api/tables/${code}/messages`, {
  author: 'Alex',
  text: '  hello table  ',
});
check('takes a message from someone seated', said.status === 200, said.body);
check(
  'trims it and keeps who said it',
  tableIn(said).messages.at(-1)?.text === 'hello table' &&
    tableIn(said).messages.at(-1)?.author === 'Alex',
  tableIn(said).messages.at(-1),
);
check(
  'refuses a message from someone not seated',
  (await post(`/api/tables/${code}/messages`, { author: 'Stranger', text: 'hi' })).status === 409,
);
check(
  'refuses an empty message',
  (await post(`/api/tables/${code}/messages`, { author: 'Alex', text: '   ' })).status === 400,
);
check(
  'refuses a message with nobody behind it',
  (await post(`/api/tables/${code}/messages`, { text: 'hi' })).status === 400,
);

const started = await post(`/api/tables/${code}/start`);
check(
  'starts the game',
  started.status === 200 && tableIn(started).phase === 'playing',
  started.body,
);
check('deals a board on starting', tableIn(started).view?.shared !== undefined, started.body);
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
  lastTable = tableIn(seen);
  const shared = lastTable.view?.shared;
  if (shared === undefined) {
    check('the board is readable while playing', false, lastTable);
    break;
  }
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
    lastPlayed = tableIn(played);
    finished = tableIn(played).finished;
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
      lastPlayed = tableIn(played);
      finished = tableIn(played).finished;
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
  reread.status === 200 && tableIn(reread).finished === true,
  tableIn(reread)?.moveCount,
);
check(
  'spectator sees no private state',
  tableIn(reread).view?.own === undefined,
  tableIn(reread).view,
);
check('the log survived the whole game', tableIn(reread).moveCount === moves, {
  stored: tableIn(reread).moveCount,
  moves,
});

const winner = tableIn(reread).view?.shared?.winner;
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
console.log(`\n${checks.length - failed.length}/${checks.length} passed, ${moves} moves played`);
process.exit(failed.length === 0 ? 0 : 1);
