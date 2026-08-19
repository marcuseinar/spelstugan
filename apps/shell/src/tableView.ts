/**
 * Drawing an online table.
 *
 * Rendering only, in the same split as the rest of the shell (decision 018):
 * what the lobby says, whether it can start, and when to ask the server again
 * are decided in `table.ts`.
 */

import type { TableSnapshot } from './api.js';
import { invitationTo, lobbyStatus, readyToStart, seatsFree } from './table.js';
import { element } from './view.js';

export interface OpeningOptions {
  readonly onOpen: (name: string, seats: number) => void;
  readonly onLeave: () => void;
}

export interface JoiningOptions {
  readonly code: string;
  readonly onJoin: (name: string) => void;
  readonly onLeave: () => void;
}

export interface LobbyOptions {
  readonly table: TableSnapshot;
  readonly you: string;
  readonly pageUrl: string;
  readonly onStart: () => void;
  readonly onLeave: () => void;
  readonly onCopy: (link: string) => void;
}

const SEAT_CHOICES = [2, 3, 4] as const;

/** The first screen: name yourself, say how many are playing. */
export function renderOpening(options: OpeningOptions): HTMLElement {
  const pane = shell('Play with a friend', options.onLeave);
  const form = element('form', 'tableform');

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
  const pane = shell('Join the table', options.onLeave);
  const form = element('form', 'tableform');

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
  const pane = shell('Waiting to start', options.onLeave);
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

  pane.append(body);
  return pane;
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

/** The frame every table screen shares: a title, and a way out. */
function shell(title: string, onLeave: () => void): HTMLElement {
  const pane = element('section', 'tablepane');
  const bar = element('header', 'tablepane__bar');

  const leave = element('button', 'tablepane__leave', 'Back') as HTMLButtonElement;
  leave.type = 'button';
  leave.addEventListener('click', onLeave);
  bar.append(leave);
  bar.append(element('h2', 'tablepane__title', title));

  pane.append(bar);
  return pane;
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
