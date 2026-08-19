import { describe, expect, it } from 'vitest';
import type { Game, GameState } from './contract.js';
import { defaultView } from './contract.js';
import type { LoggedMove } from './replay.js';
import { replay } from './replay.js';
import { Session } from './session.js';

/** A game small enough that every outcome is obvious. */
interface Tally {
  readonly total: number;
}
type Move = { readonly type: 'add'; readonly amount: number };

const tally: Game<Tally, Record<string, never>, Move> = {
  id: 'tally',
  name: 'Tally',
  minPlayers: 1,
  maxPlayers: 4,

  setup: () => ({ shared: { total: 0 }, secret: {} }),

  applyMove: (state, move, playerId) => {
    if (move.amount <= 0) {
      return { accepted: false, reason: 'Amount must be positive.' };
    }
    return {
      accepted: true,
      state: { ...state, shared: { total: state.shared.total + move.amount } },
      events: [{ type: 'added', playerId, amount: move.amount }],
    };
  },

  view: defaultView,
  isFinished: (state: GameState<Tally, Record<string, never>>) => state.shared.total >= 10,
};

const PLAYERS = ['alice', 'bob'];

function session(log?: readonly LoggedMove<Move>[]) {
  return new Session({ game: tally, seed: 'seed', players: PLAYERS, ...(log && { log }) });
}

describe('Session resumed from a stored log', () => {
  const played: readonly LoggedMove<Move>[] = [
    { playerId: 'alice', move: { type: 'add', amount: 3 } },
    { playerId: 'bob', move: { type: 'add', amount: 4 } },
  ];

  it('rebuilds the state the log describes', () => {
    expect(session(played).viewFor(null).shared.total).toBe(7);
  });

  it('keeps the log it was given', () => {
    expect(session(played).history()).toEqual(played);
  });

  it('counts the moves it resumed with', () => {
    expect(session(played).moveCount).toBe(2);
  });

  it('carries on from where the log left off', () => {
    const resumed = session(played);
    resumed.attempt({ type: 'add', amount: 1 }, 'alice');

    expect(resumed.viewFor(null).shared.total).toBe(8);
    expect(resumed.moveCount).toBe(3);
  });

  it('reaches the same state as playing the moves through', () => {
    const played_through = session();
    for (const entry of played) {
      played_through.attempt(entry.move, entry.playerId);
    }

    expect(session(played).viewFor(null)).toEqual(played_through.viewFor(null));
  });

  it('resumes a finished game as finished', () => {
    expect(session([{ playerId: 'alice', move: { type: 'add', amount: 10 } }]).finished).toBe(true);
  });

  it('does not mutate the log it was handed', () => {
    const given = [...played];
    session(given).attempt({ type: 'add', amount: 1 }, 'alice');

    expect(given).toHaveLength(2);
  });

  it('refuses a log the rules reject, rather than starting from a lie', () => {
    const impossible: readonly LoggedMove<Move>[] = [
      { playerId: 'alice', move: { type: 'add', amount: -5 } },
    ];

    expect(() => session(impossible)).toThrow(/diverged/);
  });

  it('starts empty when given an empty log', () => {
    expect(session([]).viewFor(null).shared.total).toBe(0);
  });
});

describe('Session', () => {
  it('starts from the game’s opening state', () => {
    expect(session().viewFor(null).shared.total).toBe(0);
  });

  it('starts with an empty log', () => {
    expect(session().history()).toEqual([]);
  });

  it('applies an accepted move', () => {
    const game = session();
    game.attempt({ type: 'add', amount: 3 }, 'alice');

    expect(game.viewFor(null).shared.total).toBe(3);
  });

  it('reports the events of an accepted move', () => {
    const result = session().attempt({ type: 'add', amount: 3 }, 'alice');

    expect(result.accepted).toBe(true);
    expect(result.events).toEqual([{ type: 'added', playerId: 'alice', amount: 3 }]);
  });

  it('records an accepted move in the log', () => {
    const game = session();
    game.attempt({ type: 'add', amount: 3 }, 'alice');

    expect(game.history()).toEqual([{ playerId: 'alice', move: { type: 'add', amount: 3 } }]);
  });

  it('reports why a move was rejected', () => {
    const result = session().attempt({ type: 'add', amount: -1 }, 'alice');

    expect(result).toEqual({ accepted: false, reason: 'Amount must be positive.', events: [] });
  });

  it('leaves state untouched when a move is rejected', () => {
    const game = session();
    game.attempt({ type: 'add', amount: 4 }, 'alice');
    game.attempt({ type: 'add', amount: -1 }, 'bob');

    expect(game.viewFor(null).shared.total).toBe(4);
  });

  it('keeps a rejected move out of the log', () => {
    const game = session();
    game.attempt({ type: 'add', amount: -1 }, 'alice');

    expect(game.history()).toEqual([]);
  });

  it('counts only the moves it accepted', () => {
    const game = session();
    game.attempt({ type: 'add', amount: 1 }, 'alice');
    game.attempt({ type: 'add', amount: 0 }, 'bob');

    expect(game.moveCount).toBe(1);
  });

  it('serves a spectator the shared state', () => {
    expect(session().viewFor(null).own).toBeUndefined();
  });

  it('reports when the game has finished', () => {
    const game = session();
    expect(game.finished).toBe(false);

    game.attempt({ type: 'add', amount: 10 }, 'alice');

    expect(game.finished).toBe(true);
  });

  it('remembers who was seated', () => {
    expect(session().players).toEqual(PLAYERS);
  });

  /**
   * The property the eventual server depends on: state is derived from the
   * log, so the log alone is enough to reconstruct a session.
   */
  it('holds a log that replays to the same state', () => {
    const game = session();
    game.attempt({ type: 'add', amount: 2 }, 'alice');
    game.attempt({ type: 'add', amount: 5 }, 'bob');
    game.attempt({ type: 'add', amount: -3 }, 'alice');

    const rebuilt = replay(tally, 'seed', PLAYERS, game.history());

    expect(rebuilt.state.shared).toEqual(game.viewFor(null).shared);
  });
});
