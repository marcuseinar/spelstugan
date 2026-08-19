/**
 * Drawing the shell.
 *
 * Only rendering lives here. Every decision it draws — which tables this
 * browser knows about, what the lobby says, when to ask the server again — is
 * made in `remembered.ts` and `table.ts`, which are pure and tested. Same
 * split as the Ludo board (decision 018): if this file starts deciding
 * something, that decision moves out.
 */

import type { ChatLine } from './chat.js';
import type { RememberedTable } from './remembered.js';

export function element(tag: string, className: string, text?: string): HTMLElement {
  const created = document.createElement(tag);
  if (className !== '') {
    created.className = className;
  }
  if (text !== undefined) {
    created.textContent = text;
  }
  return created;
}

/** An inline icon. Drawn, never an emoji, so it scales and recolours. */
export function icon(paths: readonly string[], size = 18): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  for (const definition of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', definition);
    svg.append(path);
  }
  return svg;
}

const ICONS = {
  hash: ['M5 9h14M5 15h14M11 4L9 20M17 4l-2 16'],
  dice: [
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    'M9 9h.01',
    'M15 9h.01',
    'M12 12h.01',
    'M9 15h.01',
    'M15 15h.01',
  ],
  people: [
    'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20',
    'M9.5 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'M21 20v-1.5a4 4 0 0 0-3-3.87',
  ],
  mic: [
    'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z',
    'M19 11a7 7 0 0 1-14 0',
    'M12 18v3',
    'M4 4l16 16',
  ],
  camera: [
    'M3 8a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M16 10.5l5-3v9l-5-3',
    'M4 4l16 16',
  ],
  send: ['M4 12l16-8-6 16-2.5-6.5L4 12z'],
  back: ['M15 5l-7 7 7 7'],
  grip: ['M7 10h10'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  message: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4 4v-4H6a2 2 0 0 1-2-2z'],
} as const;

export type IconName = keyof typeof ICONS;

export function iconNamed(name: IconName, size = 18): SVGSVGElement {
  return icon(ICONS[name], size);
}

export interface SidebarOptions {
  readonly tables: readonly RememberedTable[];
  /** The table being looked at, if any. */
  readonly activeCode: string | null;
  readonly onPick: (code: string) => void;
  readonly onNew: () => void;
  /** Takes a table off this device's list. The table itself carries on. */
  readonly onClose: (code: string) => void;
}

export function renderSidebar(options: SidebarOptions): HTMLElement {
  const sidebar = element('aside', 'sidebar');

  const header = element('header', 'sidebar__header');
  header.append(element('span', 'sidebar__brand', 'Spelstugan'));
  header.append(element('span', 'sidebar__tagline', 'Games, with the talk around them'));
  sidebar.append(header);

  const list = element('div', 'sidebar__channels');
  list.append(element('h2', 'sidebar__group', 'Game tables'));

  for (const table of options.tables) {
    list.append(renderTableRow(table, options));
  }
  if (options.tables.length === 0) {
    list.append(element('p', 'sidebar__empty', 'No tables yet.'));
  }
  list.append(renderNewTableRow(options.onNew, options.activeCode === null));
  sidebar.append(list);

  const footer = element('footer', 'sidebar__footer');
  footer.append(element('span', 'sidebar__note', 'Tables are remembered on this device only.'));
  sidebar.append(footer);

  return sidebar;
}

function renderTableRow(table: RememberedTable, options: SidebarOptions): HTMLElement {
  // A row rather than a button, because it holds two of them: one to open the
  // table and one to be rid of it.
  const row = element('div', 'channel');
  row.classList.toggle('channel--active', table.code === options.activeCode);

  const open = element('button', 'channel__open') as HTMLButtonElement;
  open.type = 'button';

  const glyph = element('span', 'channel__icon');
  glyph.append(iconNamed('dice', 16));
  open.append(glyph);

  const body = element('span', 'channel__body');
  body.append(element('span', 'channel__name', table.code));
  body.append(element('span', 'channel__subtitle', `as ${table.name}`));
  open.append(body);
  open.addEventListener('click', () => options.onPick(table.code));
  row.append(open);

  const close = element('button', 'channel__close') as HTMLButtonElement;
  close.type = 'button';
  close.title = `Leave table ${table.code}`;
  close.setAttribute('aria-label', `Leave table ${table.code}`);
  close.append(iconNamed('close', 14));
  close.addEventListener('click', () => options.onClose(table.code));
  row.append(close);

  return row;
}

/** Starting a table is where the tables are, not somewhere else. */
function renderNewTableRow(onNew: () => void, active: boolean): HTMLElement {
  const row = element('button', 'channel channel--new') as HTMLButtonElement;
  row.type = 'button';
  row.classList.toggle('channel--active', active);

  const glyph = element('span', 'channel__icon');
  glyph.append(iconNamed('plus', 16));
  row.append(glyph);

  const body = element('span', 'channel__body');
  body.append(element('span', 'channel__name', 'New table'));
  row.append(body);

  row.addEventListener('click', onNew);
  return row;
}

export interface HeaderOptions {
  readonly title: string;
  /**
   * The line under the title, owned by the caller.
   *
   * Passed in rather than built here so it can be kept up to date without
   * rebuilding the bar around it (decision 027).
   */
  readonly meta: HTMLElement;
  readonly onBack: () => void;
}

export function renderHeader(options: HeaderOptions): HTMLElement {
  const header = element('header', 'topbar');

  const back = element('button', 'topbar__back') as HTMLButtonElement;
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to tables');
  back.append(iconNamed('back', 20));
  back.addEventListener('click', options.onBack);
  header.append(back);

  const title = element('div', 'topbar__title');
  const glyph = element('span', 'topbar__icon');
  glyph.append(iconNamed('dice', 18));
  title.append(glyph);
  title.append(element('span', 'topbar__name', options.title));
  title.append(options.meta);
  header.append(title);

  const actions = element('div', 'topbar__actions');

  // Voice and video are reserved in the UI but not built (decision 006). The
  // control is shown disabled rather than omitted, so the layout does not
  // shift when it becomes real.
  const call = element('div', 'callbar');
  call.title = 'Voice and video are not built yet';
  call.append(iconNamed('mic', 15));
  call.append(iconNamed('camera', 15));
  call.append(element('span', 'callbar__label', 'soon'));
  actions.append(call);

  header.append(actions);
  return header;
}

export interface ComposerOptions {
  readonly placeholder: string;
  readonly onSend: (text: string) => void;
}

export function renderComposer(options: ComposerOptions): HTMLElement {
  const form = element('form', 'composer') as HTMLFormElement;

  const input = element('input', 'composer__input') as HTMLInputElement;
  input.type = 'text';
  input.placeholder = options.placeholder;
  input.autocomplete = 'off';
  form.append(input);

  const send = element('button', 'composer__send') as HTMLButtonElement;
  send.type = 'submit';
  send.title = 'Send';
  send.append(iconNamed('send', 16));
  form.append(send);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    options.onSend(input.value);
    input.value = '';
    input.focus();
  });

  return form;
}

/** Initials for an avatar. Two letters at most, so the circle stays readable. */
function initials(name: string): string {
  return name.slice(0, 2);
}

export function renderChatLines(lines: readonly ChatLine[]): HTMLElement {
  const list = element('div', 'chat');

  if (lines.length === 0) {
    list.append(element('p', 'chat__empty', 'Nothing here yet. Say something.'));
    return list;
  }

  for (const line of lines) {
    list.append(renderChatLine(line));
  }
  return list;
}

function renderChatLine(line: ChatLine): HTMLElement {
  if (line.kind === 'joined') {
    return element('p', 'chat__note', line.text);
  }

  // What the game did is context, not conversation. Rendering it as compactly
  // as a log line keeps the people audible above the dice — which is the whole
  // point of putting them in one timeline (decision 001).
  if (line.kind === 'played') {
    const played = element('p', 'chat__played');
    played.append(element('span', 'chat__played-author', line.author ?? ''));
    played.append(element('span', 'chat__played-text', ` ${line.text}`));
    return played;
  }

  const row = element('div', `chat__line chat__line--${line.kind}`);
  const author = line.author ?? '';

  const avatar = element('span', 'avatar', initials(author));
  avatar.style.setProperty('--avatar-colour', avatarColour(author));
  row.append(avatar);

  const body = element('div', 'chat__body');
  const head = element('div', 'chat__head');
  head.append(element('span', 'chat__author', author));
  body.append(head);
  body.append(element('div', 'chat__text', line.text));
  row.append(body);

  return row;
}

/**
 * A stable colour per name.
 *
 * Chat avatars are decoration, so any consistent mapping will do — unlike
 * seat colours in a game, where telling two players apart is a rule.
 */
function avatarColour(name: string): string {
  const palette = [
    'var(--seat-0)',
    'var(--seat-1)',
    'var(--seat-2)',
    'var(--seat-3)',
    'var(--accent)',
  ];
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash + name.charCodeAt(index)) % palette.length;
  }
  return palette[hash] as string;
}

export interface SheetOptions {
  /**
   * What the handle says when the sheet is closed: the latest line, owned by
   * the caller so it can change without the handle being rebuilt.
   */
  readonly summary: HTMLElement;
  readonly unreadHint: number;
  /** A pointer gesture ended, having travelled this far. A tap travels ~zero. */
  readonly onGesture: (deltaY: number) => void;
  /** Activated without a pointer: the keyboard, or assistive technology. */
  readonly onToggle: () => void;
}

/**
 * The grab handle at the top of the chat sheet.
 *
 * Both a tap target and a drag surface, because people reach for either — and
 * they are the same gesture with different distances, so the handle reports
 * only how far the pointer travelled. What that means for the sheet is decided
 * in `navigation.ts`.
 */
export function renderSheetHandle(options: SheetOptions): HTMLElement {
  const handle = element('div', 'sheet__handle');
  handle.setAttribute('role', 'button');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('aria-label', 'Table chat');

  handle.append(element('span', 'sheet__grip'));

  const row = element('div', 'sheet__summary');
  row.append(element('span', 'sheet__title', 'Table chat'));
  if (options.unreadHint > 0) {
    row.append(element('span', 'sheet__badge', String(options.unreadHint)));
  }
  handle.append(row);
  handle.append(options.summary);

  handle.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      options.onToggle();
    }
  });

  // A click carries the number of clicks in its pointer sequence; zero means
  // there was no pointer, so the activation came from assistive technology and
  // the gesture path below never ran.
  handle.addEventListener('click', (event) => {
    if ((event as MouseEvent).detail === 0) {
      options.onToggle();
    }
  });

  // Pointer events cover mouse, touch and pen with one path. The capture keeps
  // the gesture on the handle after the finger leaves it, which it always does:
  // the handle is the thing being dragged away.
  let startY: number | null = null;
  handle.addEventListener('pointerdown', (event) => {
    const pointer = event as PointerEvent;
    startY = pointer.clientY;
    handle.setPointerCapture(pointer.pointerId);
  });
  handle.addEventListener('pointerup', (event) => {
    if (startY === null) {
      return;
    }
    options.onGesture((event as PointerEvent).clientY - startY);
    startY = null;
  });
  handle.addEventListener('pointercancel', () => {
    startY = null;
  });

  return handle;
}
