/**
 * Drawing an online table.
 *
 * Rendering only, in the same split as the rest of the shell (decision 018):
 * what the lobby says, whether it can start, and when to ask the server again
 * are decided in `table.ts`.
 */

import type { TableSnapshot } from './api.js';
import { chatLinesOf, invitationTo, lobbyStatus, readyToStart, seatsFree } from './table.js';
import { element, renderChatLines, renderComposer } from './view.js';

export interface OpeningOptions {
  readonly onOpen: (name: string, seats: number) => void;
}

export interface JoiningOptions {
  readonly code: string;
  readonly onJoin: (name: string) => void;
}

export interface LobbyOptions {
  readonly table: TableSnapshot;
  readonly you: string;
  readonly pageUrl: string;
  readonly onStart: () => void;
  readonly onCopy: (link: string) => void;
  readonly onSay: (text: string) => void;
}

const SEAT_CHOICES = [2, 3, 4] as const;

/** The first screen: name yourself, say how many are playing. */
export function renderOpening(options: OpeningOptions): HTMLElement {
  const pane = element('section', 'tablepane');
  const form = element('form', 'tableform');
  form.append(element('h3', 'tableform__title', 'Start a game of Ludo'));

  const name = nameField('Your name');
  form.append(name.field);

  let seats: number = SEAT_CHOICES[0];
  const choices = element('div', 'tableform__choices');
  choices.append(element('span', 'tableform__label', 'Players'));
  const row = element('div', 'chips');
  for (const count of SEAT_CHOICES) {
    const chip = element('button', 'chip', String(count)) as HTMLButtonElement;
    chip.type = 'button';
    chip.classList.toggle('chip--on', count === seats);
    chip.addEventListener('click', () => {
      seats = count;
      for (const other of row.children) {
        other.classList.toggle('chip--on', other === chip);
      }
    });
    row.append(chip);
  }
  choices.append(row);
  form.append(choices);

  form.append(submit('Open a table'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (name.value() !== '') {
      options.onOpen(name.value(), seats);
    }
  });

  pane.append(form);
  return pane;
}

/** The screen someone lands on from a shared link. */
export function renderJoining(options: JoiningOptions): HTMLElement {
  const pane = element('section', 'tablepane');
  const form = element('form', 'tableform');
  form.append(element('h3', 'tableform__title', 'Take a seat'));

  form.append(element('p', 'tableform__code', options.code));
  const name = nameField('Your name');
  form.append(name.field);
  form.append(submit('Take a seat'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (name.value() !== '') {
      options.onJoin(name.value());
    }
  });

  pane.append(form);
  return pane;
}

/** Waiting for the others: the code, who has arrived, and the empty chairs. */
export function renderLobby(options: LobbyOptions): HTMLElement {
  const { table } = options;
  const pane = element('section', 'tablepane');
  const body = element('div', 'lobby');

  body.append(element('p', 'lobby__hint', 'Send this code, or the link below.'));
  body.append(element('p', 'tableform__code', table.code));

  const link = invitationTo(options.pageUrl, table.code);
  const copy = element('button', 'lobby__copy', 'Copy invite link') as HTMLButtonElement;
  copy.type = 'button';
  copy.addEventListener('click', () => options.onCopy(link));
  body.append(copy);

  body.append(renderSeats(table, options.you));
  body.append(element('p', 'lobby__status', lobbyStatus(table)));

  const start = element('button', 'lobby__start', 'Start the game') as HTMLButtonElement;
  start.type = 'button';
  start.disabled = !readyToStart(table);
  start.addEventListener('click', options.onStart);
  body.append(start);

  // Waiting for someone is exactly when there is something to say.
  body.append(renderTableChat(table, options.onSay));

  pane.append(body);
  return pane;
}

/** The table's conversation: what was said, and a way to say something. */
export function renderTableChat(table: TableSnapshot, onSay: (text: string) => void): HTMLElement {
  const chat = element('div', 'tablechat');
  const lines = renderChatLines(chatLinesOf(table));
  lines.classList.add('chat--compact');
  chat.append(lines);
  chat.append(renderComposer({ placeholder: 'Message the table…', onSend: onSay }));
  return chat;
}

function renderSeats(table: TableSnapshot, you: string): HTMLElement {
  const list = element('ul', 'lobby__seats');
  for (const player of table.players) {
    const seat = element('li', 'lobby__seat', player === you ? `${player} (you)` : player);
    seat.classList.add('lobby__seat--taken');
    list.append(seat);
  }
  for (let empty = 0; empty < seatsFree(table); empty += 1) {
    list.append(element('li', 'lobby__seat', 'empty seat'));
  }
  return list;
}

function nameField(label: string): { field: HTMLElement; value: () => string } {
  const field = element('label', 'tableform__field');
  field.append(element('span', 'tableform__label', label));

  const input = element('input', 'tableform__input') as HTMLInputElement;
  input.type = 'text';
  input.maxLength = 24;
  input.setAttribute('autocomplete', 'nickname');
  input.placeholder = 'e.g. Marcus';
  field.append(input);

  return { field, value: () => input.value.trim() };
}

function submit(label: string): HTMLButtonElement {
  const button = element('button', 'tableform__submit', label) as HTMLButtonElement;
  button.type = 'submit';
  return button;
}

/** Whatever the table has to say right now: a refusal, or a note. */
export function renderNotice(message: string): HTMLElement {
  return element('p', 'tablepane__notice', message);
}
