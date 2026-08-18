import { createRng } from '@spelstugan/game-kit';
import type { MoveContext } from '@spelstugan/game-kit';
import { describe, expect, it } from 'vitest';
import { BASE, HOME, HOME_COLUMN_START, startCellForSeat } from './board.js';
import { ludo } from './ludo.js';
import type { LudoMove, LudoShared } from './state.js';
import { position } from './testing.js';

/** A context whose die shows `roll` on its first use. */
function contextRolling(roll: number): MoveContext {
  let used = false;
  return {
    rng: {
      nextInt: () => {
        used = true;
        return roll - 1;
      },
      nextFloat: () => (used ? 0 : 0),
      shuffle: (items) => [...items],
    },
  };
}

const anyContext: MoveContext = { rng: createRng('test') };

function apply(shared: LudoShared, move: LudoMove, playerId: string, context = anyContext) {
  return ludo.applyMove({ shared, secret: {} }, move, playerId, context);
}

function expectAccepted(outcome: ReturnType<typeof apply>) {
  if (!outcome.accepted) {
    throw new Error(`Expected the move to be accepted, but it was rejected: ${outcome.reason}`);
  }
  return outcome;
}

function eventTypes(events: readonly { type: string }[]): string[] {
  return events.map((event) => event.type);
}

describe('ludo.setup', () => {
  it('seats players in the order given, all tokens in base', () => {
    const state = ludo.setup({ players: ['alice', 'bob'], rng: createRng('s') });

    expect(state.shared.seats.map((seat) => seat.playerId)).toEqual(['alice', 'bob']);
    expect(state.shared.seats[0]?.tokens).toEqual([BASE, BASE, BASE, BASE]);
  });

  it('opens on the first seat, waiting for a roll', () => {
    const state = ludo.setup({ players: ['alice', 'bob'], rng: createRng('s') });

    expect(state.shared.currentSeat).toBe(0);
    expect(state.shared.phase).toBe('roll');
    expect(state.shared.winner).toBeNull();
  });

  it('starts with no hidden state', () => {
    const state = ludo.setup({ players: ['alice', 'bob'], rng: createRng('s') });

    expect(state.secret).toEqual({});
  });

  it.each([1, 5])('refuses to seat %i players', (count) => {
    const players = Array.from({ length: count }, (_, index) => `p${index}`);

    expect(() => ludo.setup({ players, rng: createRng('s') })).toThrow(RangeError);
  });

  it('refuses to seat the same player twice', () => {
    expect(() => ludo.setup({ players: ['alice', 'alice'], rng: createRng('s') })).toThrow();
  });
});

describe('ludo.applyMove — who may move', () => {
  const shared = position({ tokens: [[5], [5]], phase: 'roll' });

  it('rejects a move from a player who is not seated', () => {
    const outcome = apply(shared, { type: 'roll' }, 'mallory');

    expect(outcome).toEqual({ accepted: false, reason: 'You are not seated in this game.' });
  });

  it('rejects a move from a seated player when it is not their turn', () => {
    const outcome = apply(shared, { type: 'roll' }, 'p1');

    expect(outcome).toEqual({ accepted: false, reason: 'It is not your turn.' });
  });

  it('rejects any move once the game has been won', () => {
    const finished = position({ tokens: [[5], [5]], phase: 'roll', winner: 'p0' });

    expect(apply(finished, { type: 'roll' }, 'p0')).toEqual({
      accepted: false,
      reason: 'The game is over.',
    });
  });

  it('rejects a token move while a roll is expected', () => {
    const outcome = apply(shared, { type: 'move', tokenIndex: 0 }, 'p0');

    expect(outcome).toEqual({ accepted: false, reason: 'Expected a roll, got a move.' });
  });

  it('rejects a roll while a token move is expected', () => {
    const awaitingMove = position({ tokens: [[5], [5]], phase: 'move', lastRoll: 3 });

    expect(apply(awaitingMove, { type: 'roll' }, 'p0')).toEqual({
      accepted: false,
      reason: 'Expected a move, got a roll.',
    });
  });

  it('leaves state untouched when a move is rejected', () => {
    const before = structuredClone(shared);
    apply(shared, { type: 'roll' }, 'p1');

    expect(shared).toEqual(before);
  });
});

describe('ludo.applyMove — rolling', () => {
  it('records the roll and waits for a token to spend it on', () => {
    const shared = position({ tokens: [[5], [5]], phase: 'roll' });
    const outcome = expectAccepted(apply(shared, { type: 'roll' }, 'p0', contextRolling(3)));

    expect(outcome.state.shared.phase).toBe('move');
    expect(outcome.state.shared.lastRoll).toBe(3);
    expect(eventTypes(outcome.events)).toEqual(['rolled']);
  });

  it('passes the turn when the roll cannot be spent anywhere', () => {
    const stuck = position({ tokens: [[BASE, BASE, BASE, BASE], [5]], phase: 'roll' });
    const outcome = expectAccepted(apply(stuck, { type: 'roll' }, 'p0', contextRolling(3)));

    expect(outcome.state.shared.currentSeat).toBe(1);
    expect(outcome.state.shared.phase).toBe('roll');
    expect(eventTypes(outcome.events)).toEqual(['rolled', 'no-legal-move', 'turn-ended']);
  });

  it('counts sixes as they accumulate', () => {
    const shared = position({ tokens: [[5], [5]], phase: 'roll', consecutiveSixes: 1 });
    const outcome = expectAccepted(apply(shared, { type: 'roll' }, 'p0', contextRolling(6)));

    expect(outcome.state.shared.consecutiveSixes).toBe(2);
  });

  it('resets the six counter on any other roll', () => {
    const shared = position({ tokens: [[5], [5]], phase: 'roll', consecutiveSixes: 2 });
    const outcome = expectAccepted(apply(shared, { type: 'roll' }, 'p0', contextRolling(4)));

    expect(outcome.state.shared.consecutiveSixes).toBe(0);
  });

  it('forfeits the turn on a third consecutive six', () => {
    const shared = position({ tokens: [[5], [5]], phase: 'roll', consecutiveSixes: 2 });
    const outcome = expectAccepted(apply(shared, { type: 'roll' }, 'p0', contextRolling(6)));

    expect(outcome.state.shared.currentSeat).toBe(1);
    expect(outcome.state.shared.consecutiveSixes).toBe(0);
    expect(eventTypes(outcome.events)).toEqual(['rolled', 'turn-forfeited', 'turn-ended']);
  });

  it('forfeits on the third six even though the six could otherwise be spent', () => {
    const shared = position({ tokens: [[BASE], [5]], phase: 'roll', consecutiveSixes: 2 });
    const outcome = expectAccepted(apply(shared, { type: 'roll' }, 'p0', contextRolling(6)));

    expect(eventTypes(outcome.events)).toContain('turn-forfeited');
  });

  it('rolls only within the faces of a die', () => {
    const shared = position({ tokens: [[5], [5]], phase: 'roll' });
    const rolls = Array.from({ length: 60 }, (_, index) => {
      const outcome = apply(shared, { type: 'roll' }, 'p0', { rng: createRng(`seed-${index}`) });
      return expectAccepted(outcome).events[0]?.roll as number;
    });

    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(6);
  });
});

describe('ludo.applyMove — moving a token', () => {
  it('advances the chosen token and ends the turn', () => {
    const shared = position({ tokens: [[5], [40]], phase: 'move', lastRoll: 3 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.seats[0]?.tokens[0]).toBe(8);
    expect(outcome.state.shared.currentSeat).toBe(1);
    expect(eventTypes(outcome.events)).toEqual(['moved', 'turn-ended']);
  });

  it('releases a token from base on a six', () => {
    const shared = position({ tokens: [[BASE], [40]], phase: 'move', lastRoll: 6 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.seats[0]?.tokens[0]).toBe(0);
  });

  it('rejects moving a token the roll cannot be spent on', () => {
    const shared = position({ tokens: [[BASE], [40]], phase: 'move', lastRoll: 3 });

    expect(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0')).toEqual({
      accepted: false,
      reason: 'Token 0 cannot move 3.',
    });
  });

  it('rejects an unknown token index', () => {
    const shared = position({ tokens: [[5], [40]], phase: 'move', lastRoll: 3 });
    const outcome = apply(shared, { type: 'move', tokenIndex: 99 }, 'p0');

    expect(outcome.accepted).toBe(false);
  });

  it('sends a captured opponent token back to base', () => {
    // Seat 1's token at progress 1 stands where seat 0 lands from progress 10 + 4.
    const landing = startCellForSeat(1) + 1;
    const shared = position({ tokens: [[landing - 4], [1]], phase: 'move', lastRoll: 4 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.seats[1]?.tokens[0]).toBe(BASE);
    expect(eventTypes(outcome.events)).toContain('captured');
  });

  it('brings a token home on an exact roll', () => {
    const shared = position({ tokens: [[HOME - 2], [40]], phase: 'move', lastRoll: 2 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.seats[0]?.tokens[0]).toBe(HOME);
    expect(eventTypes(outcome.events)).toContain('token-home');
  });

  it('declares a winner when the last token comes home', () => {
    const shared = position({
      tokens: [[HOME, HOME, HOME, HOME - 1], [40]],
      phase: 'move',
      lastRoll: 1,
    });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 3 }, 'p0'));

    expect(outcome.state.shared.winner).toBe('p0');
    expect(eventTypes(outcome.events)).toContain('game-won');
  });

  it('wraps the turn around to the first seat', () => {
    const shared = position({ tokens: [[5], [5]], currentSeat: 1, phase: 'move', lastRoll: 3 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p1'));

    expect(outcome.state.shared.currentSeat).toBe(0);
  });
});

describe('ludo — the extra-turn rule', () => {
  // MC/DC: a player keeps the turn if the roll was a six, OR the move captured,
  // OR it brought a token home. Each pair below flips exactly one of those
  // three while holding the others false, and the outcome flips with it.

  const quietMove = position({ tokens: [[5], [40]], phase: 'move', lastRoll: 3 });

  it('baseline: no six, no capture, no token home — the turn ends', () => {
    const outcome = expectAccepted(apply(quietMove, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(eventTypes(outcome.events)).toContain('turn-ended');
    expect(eventTypes(outcome.events)).not.toContain('extra-turn');
  });

  it('condition: a six alone earns another turn', () => {
    const shared = position({ tokens: [[5], [40]], phase: 'move', lastRoll: 6 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(eventTypes(outcome.events)).toContain('extra-turn');
    expect(outcome.state.shared.currentSeat).toBe(0);
  });

  it('condition: a capture alone earns another turn', () => {
    const landing = startCellForSeat(1) + 1;
    const shared = position({ tokens: [[landing - 3], [1]], phase: 'move', lastRoll: 3 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(eventTypes(outcome.events)).toContain('captured');
    expect(eventTypes(outcome.events)).toContain('extra-turn');
  });

  it('condition: bringing a token home alone earns another turn', () => {
    const shared = position({ tokens: [[HOME - 3], [40]], phase: 'move', lastRoll: 3 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(eventTypes(outcome.events)).toContain('token-home');
    expect(eventTypes(outcome.events)).toContain('extra-turn');
  });

  it('clears the spent roll when keeping the turn', () => {
    const shared = position({ tokens: [[5], [40]], phase: 'move', lastRoll: 6 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.phase).toBe('roll');
    expect(outcome.state.shared.lastRoll).toBeNull();
  });

  it('does not grant an extra turn on the winning move', () => {
    const shared = position({
      tokens: [[HOME, HOME, HOME, HOME - 6], [40]],
      phase: 'move',
      lastRoll: 6,
    });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 3 }, 'p0'));

    expect(eventTypes(outcome.events)).not.toContain('extra-turn');
    expect(outcome.state.shared.winner).toBe('p0');
  });
});

describe('ludo.view', () => {
  it('shows the board to a spectator', () => {
    const state = ludo.setup({ players: ['alice', 'bob'], rng: createRng('s') });
    const view = ludo.view(state, null);

    expect(view.shared.seats).toHaveLength(2);
    expect(view.own).toBeUndefined();
  });

  it('shows a player no private state, because Ludo has none', () => {
    const state = ludo.setup({ players: ['alice', 'bob'], rng: createRng('s') });

    expect(ludo.view(state, 'alice').own).toBeUndefined();
  });
});

describe('ludo.isFinished', () => {
  it('is false while the game is in play', () => {
    const state = ludo.setup({ players: ['alice', 'bob'], rng: createRng('s') });

    expect(ludo.isFinished(state)).toBe(false);
  });

  it('is true once a winner is recorded', () => {
    const shared = position({ tokens: [[HOME], [5]], winner: 'p0' });

    expect(ludo.isFinished({ shared, secret: {} })).toBe(true);
  });
});

describe('ludo — home column', () => {
  it('lets a token pass from the track into the home column', () => {
    const shared = position({
      tokens: [[HOME_COLUMN_START - 2], [40]],
      phase: 'move',
      lastRoll: 3,
    });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.seats[0]?.tokens[0]).toBe(HOME_COLUMN_START + 1);
  });

  it('keeps a token in the home column safe from capture', () => {
    const shared = position({ tokens: [[10], [HOME_COLUMN_START]], phase: 'move', lastRoll: 4 });
    const outcome = expectAccepted(apply(shared, { type: 'move', tokenIndex: 0 }, 'p0'));

    expect(outcome.state.shared.seats[1]?.tokens[0]).toBe(HOME_COLUMN_START);
  });
});
