import { describe, expect, it } from 'vitest';
import type { GameState } from './contract.js';
import { defaultView } from './contract.js';

interface Board {
  readonly turn: number;
}
interface Hand {
  readonly cards: readonly string[];
}

const state: GameState<Board, Hand> = {
  shared: { turn: 3 },
  secret: {
    alice: { cards: ['ace'] },
    bob: { cards: ['king'] },
  },
};

describe('defaultView', () => {
  it('gives a spectator the shared state only', () => {
    const view = defaultView(state, null);

    expect(view.shared).toEqual({ turn: 3 });
    expect(view.own).toBeUndefined();
  });

  it('gives a player their own secret alongside the shared state', () => {
    const view = defaultView(state, 'alice');

    expect(view.shared).toEqual({ turn: 3 });
    expect(view.own).toEqual({ cards: ['ace'] });
  });

  it('never leaks another player’s secret', () => {
    const view = defaultView(state, 'alice');

    expect(JSON.stringify(view)).not.toContain('king');
  });

  it('treats an unknown viewer as a spectator', () => {
    const view = defaultView(state, 'mallory');

    expect(view.own).toBeUndefined();
  });

  it('omits own state for a game that has no secrets', () => {
    const noSecrets: GameState<Board, Record<string, never>> = { shared: { turn: 1 }, secret: {} };

    expect(defaultView(noSecrets, 'alice').own).toBeUndefined();
  });
});
