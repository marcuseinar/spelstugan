/**
 * The Ludo UI.
 *
 * It renders the view it is given and reports what the player tried to do. It
 * never decides legality — it asks the rules what is movable, and the reducer
 * remains the authority regardless of what this sends.
 */

import type { GameUi, GameUiContext, MountedGameUi, PlayerView } from '@spelstugan/game-kit';
import { legalTokenIndices } from '../moves.js';
import type { LudoMove, LudoSecret, LudoShared } from '../state.js';
import { currentSeat } from '../state.js';
import { type BoardHandle, type TokenTarget, createBoard } from './board.js';

function panelElement(tag: string, className: string, text?: string): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

/** What the player should be told is happening right now. */
function statusText(shared: LudoShared, viewerId: string | null): string {
  if (shared.winner !== null) {
    return shared.winner === viewerId ? 'You won.' : `${shared.winner} won.`;
  }

  const current = currentSeat(shared).playerId;
  const isYours = current === viewerId;

  if (shared.phase === 'roll') {
    return isYours ? 'Your turn — roll the die.' : `Waiting for ${current} to roll.`;
  }
  return isYours
    ? `You rolled ${shared.lastRoll}. Choose a token.`
    : `${current} rolled ${shared.lastRoll}.`;
}

/** Tokens this viewer may move, which is nothing unless it is their turn. */
function movableTokens(shared: LudoShared, viewerId: string | null): readonly TokenTarget[] {
  if (shared.winner !== null || shared.phase !== 'move' || shared.lastRoll === null) {
    return [];
  }
  if (currentSeat(shared).playerId !== viewerId) {
    return [];
  }
  const seat = shared.currentSeat;
  return legalTokenIndices(shared, seat, shared.lastRoll).map((tokenIndex) => ({
    seat,
    tokenIndex,
  }));
}

function renderSeats(shared: LudoShared, viewerId: string | null): HTMLElement {
  const list = panelElement('ul', 'seats');

  shared.seats.forEach((seat, index) => {
    const item = panelElement('li', 'seat');
    item.style.setProperty('--seat-colour', `var(--seat-${index})`);
    if (index === shared.currentSeat && shared.winner === null) {
      item.classList.add('seat--active');
    }
    if (seat.playerId === shared.winner) {
      item.classList.add('seat--winner');
    }

    item.append(panelElement('span', 'seat__dot'));
    const name = seat.playerId === viewerId ? `${seat.playerId} (you)` : seat.playerId;
    item.append(panelElement('span', 'seat__name', name));

    const home = seat.tokens.filter((progress) => progress === 57).length;
    item.append(panelElement('span', 'seat__home', `${home}/4 home`));

    list.append(item);
  });

  return list;
}

/** The die face, or a prompt to roll. */
function renderDie(shared: LudoShared, canRoll: boolean, onRoll: () => void): HTMLElement {
  const wrapper = panelElement('div', 'die-area');

  if (shared.lastRoll !== null) {
    const face = panelElement('div', 'die', String(shared.lastRoll));
    face.setAttribute('aria-label', `Rolled ${shared.lastRoll}`);
    wrapper.append(face);
  }

  if (canRoll) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'roll-button';
    button.textContent = 'Roll';
    button.addEventListener('click', onRoll);
    wrapper.append(button);
  }

  return wrapper;
}

export const ludoUi: GameUi<LudoShared, LudoSecret, LudoMove> = {
  mount(
    container: HTMLElement,
    context: GameUiContext<LudoShared, LudoSecret, LudoMove>,
  ): MountedGameUi<LudoShared, LudoSecret> {
    const root = panelElement('div', 'ludo');
    const boardWrapper = panelElement('div', 'ludo__board');
    const panel = panelElement('aside', 'ludo__panel');
    root.append(boardWrapper, panel);
    container.append(root);

    const board: BoardHandle = createBoard();
    boardWrapper.append(board.svg);

    let destroyed = false;

    const draw = (view: PlayerView<LudoShared, LudoSecret>) => {
      const { shared } = view;
      const viewerId = context.viewerId;
      const isViewersTurn = currentSeat(shared).playerId === viewerId;
      const canRoll = shared.winner === null && shared.phase === 'roll' && isViewersTurn;

      board.render(shared, {
        movable: movableTokens(shared, viewerId),
        onTokenPicked: ({ tokenIndex }) => context.dispatch({ type: 'move', tokenIndex }),
      });

      panel.replaceChildren(
        panelElement('p', 'status', statusText(shared, viewerId)),
        renderDie(shared, canRoll, () => context.dispatch({ type: 'roll' })),
        renderSeats(shared, viewerId),
      );
    };

    draw(context.view);

    return {
      update(view) {
        if (!destroyed) {
          draw(view);
        }
      },
      destroy() {
        if (destroyed) {
          return;
        }
        destroyed = true;
        root.remove();
      },
    };
  },
};

export { createBoard } from './board.js';
export type { BoardHandle, TokenTarget } from './board.js';
