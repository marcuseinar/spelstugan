/**
 * A hot-seat playground for the Ludo plugin.
 *
 * There is no server yet, so everyone plays on one screen: the viewer is
 * always whoever the rules are waiting on. That is enough to exercise the whole
 * plugin contract — setup, moves, views, replay — and to find out whether the
 * rules are any fun before building persistence around them.
 */

import { ludo, ludoUi } from '@spelstugan/ludo';
import type { LudoMove, LudoSecret, LudoShared } from '@spelstugan/ludo';
import { Session } from './session.js';
import './style.css';

const PLAYERS = ['Alice', 'Bob', 'Carol', 'Dev'];

function requireElement(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (found === null) {
    throw new Error(`The page is missing #${id}.`);
  }
  return found;
}

const boardHost = requireElement('board');
const logHost = requireElement('log');

let session: Session<LudoShared, LudoSecret, LudoMove>;
let mounted: ReturnType<typeof ludoUi.mount> | null = null;

/** Whoever the rules are waiting on — the hot seat. */
function playerOnTurn(): string {
  const { shared } = session.viewFor(null);
  return shared.seats[shared.currentSeat]?.playerId ?? PLAYERS[0] ?? '';
}

function appendToLog(message: string, kind = 'plain'): void {
  const line = document.createElement('li');
  line.className = `log__line log__line--${kind}`;
  line.textContent = message;
  logHost.prepend(line);
}

function describe(event: { type: string; [key: string]: unknown }): string | null {
  const who = String(event.playerId ?? '');
  switch (event.type) {
    case 'rolled':
      return `${who} rolled ${event.roll}.`;
    case 'captured':
      return `${event.byPlayerId} sent ${who} home.`;
    case 'token-home':
      return `${who} got a token home.`;
    case 'extra-turn':
      return `${who} goes again.`;
    case 'no-legal-move':
      return `${who} had no legal move.`;
    case 'turn-forfeited':
      return `${who} rolled three sixes and lost the turn.`;
    case 'game-won':
      return `${who} won the game.`;
    default:
      return null;
  }
}

function render(): void {
  mounted?.destroy();
  const viewerId = playerOnTurn();

  mounted = ludoUi.mount(boardHost, {
    view: session.viewFor(viewerId),
    viewerId,
    dispatch: (move) => {
      const result = session.attempt(move, viewerId);

      if (!result.accepted) {
        appendToLog(result.reason ?? 'Move rejected.', 'rejected');
        return;
      }
      for (const event of result.events) {
        const message = describe(event);
        if (message !== null) {
          appendToLog(message, event.type === 'game-won' ? 'win' : 'plain');
        }
      }
      render();
    },
  });
}

function startNewGame(): void {
  // A fresh seed per game, recorded so a session could be replayed exactly.
  const seed = `playground-${Date.now()}`;
  session = new Session(ludo, seed, PLAYERS);
  logHost.replaceChildren();
  appendToLog(`New game — ${PLAYERS.join(', ')}.`);
  render();
}

requireElement('new-game').addEventListener('click', startNewGame);
startNewGame();
