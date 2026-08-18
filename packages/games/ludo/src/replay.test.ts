/**
 * The properties the whole architecture rests on.
 *
 * If replay is not exact, then spectating, resuming an asynchronous game and
 * verifying a result are all unreliable — so these are tested as invariants
 * over many generated games, not as a handful of examples.
 */

import type { LoggedMove } from '@spelstugan/game-kit';
import { createRng, replay, seedForMove } from '@spelstugan/game-kit';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ludo } from './ludo.js';
import { legalTokenIndices } from './moves.js';
import type { LudoMove, LudoState } from './state.js';

const PLAYERS = ['alice', 'bob', 'carol'] as const;

/**
 * Plays a game by always taking the first legal option, recording the log.
 *
 * A fixed choice keeps the generated game a pure function of the seed, which
 * is what lets the replay assertions compare like with like.
 */
function playOut(sessionSeed: string, maxMoves: number) {
  const players = [...PLAYERS];
  let state: LudoState = ludo.setup({
    players,
    rng: createRng(seedForMove(sessionSeed, 0)),
  });
  const log: LoggedMove<LudoMove>[] = [];

  for (let moveNumber = 1; moveNumber <= maxMoves; moveNumber += 1) {
    if (ludo.isFinished(state)) {
      break;
    }

    const { shared } = state;
    const playerId = shared.seats[shared.currentSeat]?.playerId as string;
    const move: LudoMove =
      shared.phase === 'roll'
        ? { type: 'roll' }
        : {
            type: 'move',
            tokenIndex: legalTokenIndices(shared, shared.currentSeat, shared.lastRoll ?? 0)[0] ?? 0,
          };

    const outcome = ludo.applyMove(state, move, playerId, {
      rng: createRng(seedForMove(sessionSeed, moveNumber)),
    });

    if (!outcome.accepted) {
      throw new Error(`Generated an illegal move at ${moveNumber}: ${outcome.reason}`);
    }

    state = outcome.state;
    log.push({ playerId, move });
  }

  return { state, log, players };
}

describe('replay', () => {
  it('reproduces the exact final state from the move log', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (sessionSeed) => {
        const played = playOut(sessionSeed, 120);
        const replayed = replay(ludo, sessionSeed, played.players, played.log);

        expect(replayed.state).toEqual(played.state);
      }),
      { numRuns: 40 },
    );
  });

  it('reproduces the same state from every prefix of the log', () => {
    const sessionSeed = 'prefix-check';
    const played = playOut(sessionSeed, 60);

    for (let length = 0; length <= played.log.length; length += 1) {
      const prefix = played.log.slice(0, length);
      const fromPrefix = replay(ludo, sessionSeed, played.players, prefix);
      const fromPrefixAgain = replay(ludo, sessionSeed, played.players, prefix);

      expect(fromPrefix.state).toEqual(fromPrefixAgain.state);
    }
  });

  it('replays an empty log to the opening position', () => {
    const opening = replay(ludo, 'seed', [...PLAYERS], []);

    expect(opening.state).toEqual(ludo.setup({ players: [...PLAYERS], rng: createRng('seed:0') }));
  });

  it('throws when the log holds a move the rules reject', () => {
    const corrupted: LoggedMove<LudoMove>[] = [{ playerId: 'bob', move: { type: 'roll' } }];

    expect(() => replay(ludo, 'seed', [...PLAYERS], corrupted)).toThrow(/diverged/);
  });
});

describe('ludo — invariants across generated games', () => {
  it('never rejects a move it reported as legal', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (sessionSeed) => {
        // playOut throws if any generated legal move is rejected.
        expect(() => playOut(sessionSeed, 120)).not.toThrow();
      }),
      { numRuns: 40 },
    );
  });

  it('keeps every token in a valid position', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (sessionSeed) => {
        const { state } = playOut(sessionSeed, 120);

        return state.shared.seats.every((seat) =>
          seat.tokens.every((progress) => progress >= -1 && progress <= 57),
        );
      }),
      { numRuns: 40 },
    );
  });

  it('keeps exactly four tokens per seat', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (sessionSeed) => {
        const { state } = playOut(sessionSeed, 120);

        return state.shared.seats.every((seat) => seat.tokens.length === 4);
      }),
      { numRuns: 30 },
    );
  });

  it('never seats two of one player’s tokens on the same shared-track cell', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (sessionSeed) => {
        const { state } = playOut(sessionSeed, 120);

        return state.shared.seats.every((seat) => {
          const onTrack = seat.tokens.filter((progress) => progress >= 0 && progress <= 51);
          return new Set(onTrack).size === onTrack.length;
        });
      }),
      { numRuns: 30 },
    );
  });

  it('leaves state untouched whenever a move is rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 0, max: 10 }),
        (sessionSeed, tokenIndex) => {
          const { state } = playOut(sessionSeed, 30);
          const before = structuredClone(state);

          // 'mallory' is never seated, so every one of these is rejected.
          ludo.applyMove(state, { type: 'move', tokenIndex }, 'mallory', {
            rng: createRng('x'),
          });

          expect(state).toEqual(before);
        },
      ),
      { numRuns: 30 },
    );
  });
});
