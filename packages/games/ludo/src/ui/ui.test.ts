/**
 * @vitest-environment jsdom
 *
 * The UI's job is to show the right state and report intent. These tests hold
 * it to exactly that: what is on screen, and what gets dispatched when a player
 * clicks. Legality is the reducer's business and is tested there.
 */

import { describe, expect, it, vi } from 'vitest';
import { BASE, HOME } from '../board.js';
import type { LudoMove, LudoShared } from '../state.js';
import { position } from '../testing.js';
import { ludoUi } from './index.js';

function mount(shared: LudoShared, viewerId: string | null) {
  const container = document.createElement('div');
  document.body.append(container);
  const dispatch = vi.fn<(move: LudoMove) => void>();

  const mounted = ludoUi.mount(container, {
    view: { shared },
    viewerId,
    dispatch,
  });

  return { container, dispatch, mounted };
}

function movableTokens(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('.token--movable')];
}

describe('ludoUi — what the board shows', () => {
  it('draws a token for every token in play', () => {
    const { container } = mount(position({ tokens: [[5], [10]] }), 'p0');

    expect(container.querySelectorAll('.token')).toHaveLength(8);
  });

  it('draws the board once, not once per render', () => {
    const { container, mounted } = mount(position({ tokens: [[5], [10]] }), 'p0');
    mounted.update({ shared: position({ tokens: [[6], [10]] }) });

    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('moves a token when the state says it moved', () => {
    const positionOf = (container: HTMLElement) => {
      const token = container.querySelector('.token');
      return `${token?.getAttribute('cx')},${token?.getAttribute('cy')}`;
    };

    const { container, mounted } = mount(position({ tokens: [[0], [10]] }), 'p0');
    const before = positionOf(container);

    mounted.update({ shared: position({ tokens: [[5], [10]] }) });

    expect(positionOf(container)).not.toBe(before);
  });
});

describe('ludoUi — whose turn it is', () => {
  it('offers a roll when it is the viewer’s turn', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p0');

    expect(container.querySelector('.roll-button')).not.toBeNull();
  });

  it('offers no roll when it is someone else’s turn', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p1');

    expect(container.querySelector('.roll-button')).toBeNull();
  });

  it('offers no roll to a spectator', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), null);

    expect(container.querySelector('.roll-button')).toBeNull();
  });

  it('offers no roll once the game is won', () => {
    const shared = position({ tokens: [[HOME], [10]], phase: 'roll', winner: 'p0' });
    const { container } = mount(shared, 'p0');

    expect(container.querySelector('.roll-button')).toBeNull();
  });

  it('dispatches a roll when the button is clicked', () => {
    const { container, dispatch } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p0');

    container.querySelector<HTMLButtonElement>('.roll-button')?.click();

    expect(dispatch).toHaveBeenCalledWith({ type: 'roll' });
  });

  it('tells the viewer to choose a token once they have rolled', () => {
    const shared = position({ tokens: [[5], [10]], phase: 'move', lastRoll: 4 });
    const { container } = mount(shared, 'p0');

    expect(container.querySelector('.status')?.textContent).toBe('You rolled 4. Choose a token.');
  });

  it('tells everyone else what was rolled', () => {
    const shared = position({ tokens: [[5], [10]], phase: 'move', lastRoll: 4 });
    const { container } = mount(shared, 'p1');

    expect(container.querySelector('.status')?.textContent).toBe('p0 rolled 4.');
  });

  it('names who is being waited on to roll', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p1');

    expect(container.querySelector('.status')?.textContent).toBe('Waiting for p0 to roll.');
  });

  it('shows the rolled number', () => {
    const shared = position({ tokens: [[5], [10]], phase: 'move', lastRoll: 4 });
    const { container } = mount(shared, 'p0');

    expect(container.querySelector('.die')?.textContent).toBe('4');
  });
});

describe('ludoUi — choosing a token', () => {
  const awaitingMove = position({ tokens: [[5, BASE], [10]], phase: 'move', lastRoll: 3 });

  it('marks only the tokens that can legally move', () => {
    const { container } = mount(awaitingMove, 'p0');

    // Token 0 can advance; the rest are in base and need a six.
    expect(movableTokens(container)).toHaveLength(1);
  });

  it('dispatches the chosen token', () => {
    const { container, dispatch } = mount(awaitingMove, 'p0');

    (movableTokens(container)[0] as SVGElement).dispatchEvent(
      new window.MouseEvent('click', { bubbles: true }),
    );

    expect(dispatch).toHaveBeenCalledWith({ type: 'move', tokenIndex: 0 });
  });

  it('marks nothing movable for the player who is not on turn', () => {
    const { container } = mount(awaitingMove, 'p1');

    expect(movableTokens(container)).toHaveLength(0);
  });

  it('marks nothing movable for a spectator', () => {
    const { container } = mount(awaitingMove, null);

    expect(movableTokens(container)).toHaveLength(0);
  });

  it('marks nothing movable once the game is won, even mid-turn', () => {
    // The winning move leaves the roll spent but the phase mid-flight; without
    // the winner check the board would still invite a move after the game ended.
    const shared = position({
      tokens: [[5, BASE], [10]],
      phase: 'move',
      lastRoll: 3,
      winner: 'p0',
    });
    const { container } = mount(shared, 'p0');

    expect(movableTokens(container)).toHaveLength(0);
  });

  it('marks nothing movable when no roll has been made', () => {
    const shared = position({ tokens: [[5, BASE], [10]], phase: 'move', lastRoll: null });
    const { container } = mount(shared, 'p0');

    expect(movableTokens(container)).toHaveLength(0);
  });

  it('marks nothing movable while a roll is still owed', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p0');

    expect(movableTokens(container)).toHaveLength(0);
  });

  it('marks every token movable on a six, since any may be released', () => {
    const shared = position({
      tokens: [[BASE, BASE, BASE, BASE], [10]],
      phase: 'move',
      lastRoll: 6,
    });
    const { container } = mount(shared, 'p0');

    expect(movableTokens(container)).toHaveLength(4);
  });
});

describe('ludoUi — the panel', () => {
  it('tells the viewer it is their turn', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p0');

    expect(container.querySelector('.status')?.textContent).toMatch(/your turn/i);
  });

  it('names whoever is being waited on', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p1');

    expect(container.querySelector('.status')?.textContent).toContain('p0');
  });

  it('announces the winner', () => {
    const shared = position({ tokens: [[HOME], [10]], winner: 'p1' });
    const { container } = mount(shared, 'p0');

    expect(container.querySelector('.status')?.textContent).toBe('p1 won.');
  });

  it('tells the winner they won', () => {
    const shared = position({ tokens: [[HOME], [10]], winner: 'p0' });
    const { container } = mount(shared, 'p0');

    expect(container.querySelector('.status')?.textContent).toBe('You won.');
  });

  it('lists one entry per seat', () => {
    const { container } = mount(position({ tokens: [[5], [10], [2]] }), 'p0');

    expect(container.querySelectorAll('.seat')).toHaveLength(3);
  });

  it('marks the seat whose turn it is', () => {
    const shared = position({ tokens: [[5], [10]], currentSeat: 1 });
    const { container } = mount(shared, 'p0');
    const seats = [...container.querySelectorAll('.seat')];

    expect(seats[1]?.classList.contains('seat--active')).toBe(true);
    expect(seats[0]?.classList.contains('seat--active')).toBe(false);
  });

  it('leaves the seat colour swatch free of text', () => {
    const { container } = mount(position({ tokens: [[5], [10]] }), 'p0');

    expect(container.querySelector('.seat__dot')?.textContent).toBe('');
  });

  it('shows no die before anything has been rolled', () => {
    const { container } = mount(position({ tokens: [[5], [10]], phase: 'roll' }), 'p0');

    expect(container.querySelector('.die')).toBeNull();
  });

  it('marks the winning seat', () => {
    const shared = position({ tokens: [[HOME], [10]], winner: 'p0' });
    const { container } = mount(shared, 'p0');
    const seats = [...container.querySelectorAll('.seat')];

    expect(seats[0]?.classList.contains('seat--winner')).toBe(true);
    expect(seats[1]?.classList.contains('seat--winner')).toBe(false);
  });

  it('marks no seat as on turn once the game is over', () => {
    const shared = position({ tokens: [[HOME], [10]], winner: 'p0' });
    const { container } = mount(shared, 'p0');

    expect(container.querySelectorAll('.seat--active')).toHaveLength(0);
  });

  it('marks the viewer’s own seat', () => {
    const { container } = mount(position({ tokens: [[5], [10]] }), 'p0');

    expect(container.querySelector('.seat__name')?.textContent).toBe('p0 (you)');
  });

  it('counts how many of a seat’s tokens are home', () => {
    const shared = position({ tokens: [[HOME, HOME, 5, BASE], [10]] });
    const { container } = mount(shared, 'p0');

    expect(container.querySelector('.seat__home')?.textContent).toBe('2/4 home');
  });
});

describe('ludoUi — lifecycle', () => {
  it('removes itself when destroyed', () => {
    const { container, mounted } = mount(position({ tokens: [[5], [10]] }), 'p0');
    mounted.destroy();

    expect(container.querySelector('.ludo')).toBeNull();
  });

  it('tolerates being destroyed twice', () => {
    const { mounted } = mount(position({ tokens: [[5], [10]] }), 'p0');
    mounted.destroy();

    expect(() => mounted.destroy()).not.toThrow();
  });

  it('ignores updates after being destroyed', () => {
    const { container, mounted } = mount(position({ tokens: [[5], [10]] }), 'p0');
    mounted.destroy();
    mounted.update({ shared: position({ tokens: [[6], [10]] }) });

    expect(container.querySelector('.ludo')).toBeNull();
  });
});
