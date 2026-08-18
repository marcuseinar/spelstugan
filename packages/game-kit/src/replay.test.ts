import { describe, expect, it } from 'vitest';
import type { Game, GameState } from './contract.js';
import { defaultView } from './contract.js';
import { type LoggedMove, replay, seedForMove } from './replay.js';

/**
 * A game small enough to reason about completely.
 *
 * Replay is the platform's guarantee, not any one game's, so it is tested
 * against a toy whose every outcome is obvious — a real game would make a
 * failure here hard to attribute.
 */
interface Tally {
  readonly total: number;
  readonly rolls: readonly number[];
}
type Move = { readonly type: 'add'; readonly amount: number } | { readonly type: 'roll' };

const tallyGame: Game<Tally, Record<string, never>, Move> = {
  id: 'tally',
  name: 'Tally',
  minPlayers: 1,
  maxPlayers: 4,

  setup: () => ({ shared: { total: 0, rolls: [] }, secret: {} }),

  applyMove: (state, move, _playerId, context) => {
    if (move.type === 'add') {
      if (move.amount <= 0) {
        return { accepted: false, reason: 'Amount must be positive.' };
      }
      return {
        accepted: true,
        state: { ...state, shared: { ...state.shared, total: state.shared.total + move.amount } },
        events: [{ type: 'added', amount: move.amount }],
      };
    }

    const roll = context.rng.nextInt(6) + 1;
    return {
      accepted: true,
      state: {
        ...state,
        shared: { total: state.shared.total + roll, rolls: [...state.shared.rolls, roll] },
      },
      events: [{ type: 'rolled', roll }],
    };
  },

  view: defaultView,
  isFinished: (state: GameState<Tally, Record<string, never>>) => state.shared.total >= 100,
};

const PLAYERS = ['alice', 'bob'];

describe('seedForMove', () => {
  it('derives a distinct seed per move', () => {
    expect(seedForMove('session', 1)).not.toBe(seedForMove('session', 2));
  });

  it('derives a distinct seed per session', () => {
    expect(seedForMove('one', 1)).not.toBe(seedForMove('two', 1));
  });

  it('is stable for the same session and move', () => {
    expect(seedForMove('session', 7)).toBe(seedForMove('session', 7));
  });
});

describe('replay', () => {
  it('returns the opening state for an empty log', () => {
    const result = replay(tallyGame, 'seed', PLAYERS, []);

    expect(result.state.shared).toEqual({ total: 0, rolls: [] });
    expect(result.events).toEqual([]);
  });

  it('applies moves in order', () => {
    const log: LoggedMove<Move>[] = [
      { playerId: 'alice', move: { type: 'add', amount: 3 } },
      { playerId: 'bob', move: { type: 'add', amount: 4 } },
    ];

    expect(replay(tallyGame, 'seed', PLAYERS, log).state.shared.total).toBe(7);
  });

  it('collects the events from every move', () => {
    const log: LoggedMove<Move>[] = [
      { playerId: 'alice', move: { type: 'add', amount: 1 } },
      { playerId: 'bob', move: { type: 'add', amount: 2 } },
    ];

    expect(replay(tallyGame, 'seed', PLAYERS, log).events).toEqual([
      { type: 'added', amount: 1 },
      { type: 'added', amount: 2 },
    ]);
  });

  it('reproduces random outcomes exactly', () => {
    const log: LoggedMove<Move>[] = Array.from({ length: 8 }, () => ({
      playerId: 'alice',
      move: { type: 'roll' } as const,
    }));

    const first = replay(tallyGame, 'session-a', PLAYERS, log);
    const second = replay(tallyGame, 'session-a', PLAYERS, log);

    expect(second.state.shared.rolls).toEqual(first.state.shared.rolls);
  });

  it('gives a different session different random outcomes', () => {
    const log: LoggedMove<Move>[] = Array.from({ length: 8 }, () => ({
      playerId: 'alice',
      move: { type: 'roll' } as const,
    }));

    const first = replay(tallyGame, 'session-a', PLAYERS, log).state.shared.rolls;
    const second = replay(tallyGame, 'session-b', PLAYERS, log).state.shared.rolls;

    expect(second).not.toEqual(first);
  });

  it('seeds each move separately, so a prefix replays identically', () => {
    const log: LoggedMove<Move>[] = Array.from({ length: 6 }, () => ({
      playerId: 'alice',
      move: { type: 'roll' } as const,
    }));

    const full = replay(tallyGame, 'session-a', PLAYERS, log).state.shared.rolls;
    const prefix = replay(tallyGame, 'session-a', PLAYERS, log.slice(0, 3)).state.shared.rolls;

    expect(prefix).toEqual(full.slice(0, 3));
  });

  it('throws, naming the offending move, when the log holds a rejected move', () => {
    const log: LoggedMove<Move>[] = [
      { playerId: 'alice', move: { type: 'add', amount: 5 } },
      { playerId: 'bob', move: { type: 'add', amount: -1 } },
    ];

    expect(() => replay(tallyGame, 'seed', PLAYERS, log)).toThrow(/Move 1 .*diverged/s);
  });

  it('passes the recorded player through to the rules', () => {
    const seen: string[] = [];
    const watching: Game<Tally, Record<string, never>, Move> = {
      ...tallyGame,
      applyMove: (state, move, playerId, context) => {
        seen.push(playerId);
        return tallyGame.applyMove(state, move, playerId, context);
      },
    };

    replay(watching, 'seed', PLAYERS, [
      { playerId: 'bob', move: { type: 'add', amount: 1 } },
      { playerId: 'alice', move: { type: 'add', amount: 1 } },
    ]);

    expect(seen).toEqual(['bob', 'alice']);
  });

  it('passes the seated players through to setup', () => {
    let seated: readonly string[] = [];
    const watching: Game<Tally, Record<string, never>, Move> = {
      ...tallyGame,
      setup: (context) => {
        seated = context.players;
        return tallyGame.setup(context);
      },
    };

    replay(watching, 'seed', PLAYERS, []);

    expect(seated).toEqual(PLAYERS);
  });
});
