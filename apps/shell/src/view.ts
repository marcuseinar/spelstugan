/**
 * Drawing the shell.
 *
 * Only rendering lives here. Every decision the shell makes — which channel
 * opens, how channels are grouped, what a game event says in chat — is in
 * `workspace.ts` and `chat.ts`, which are pure and tested. Same split as the
 * Ludo board (decision 018): if this file starts deciding something, that
 * decision moves out.
 */

import type { ChatLine } from './chat.js';
import type { Channel, ChannelGroup, Server } from './workspace.js';

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
  message: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4 4v-4H6a2 2 0 0 1-2-2z'],
} as const;

export type IconName = keyof typeof ICONS;

export function iconNamed(name: IconName, size = 18): SVGSVGElement {
  return icon(ICONS[name], size);
}

export interface RailOptions {
  readonly servers: readonly Server[];
  readonly activeServerId: string;
  readonly onPick: (serverId: string) => void;
}

export function renderRail(options: RailOptions): HTMLElement {
  const rail = element('nav', 'rail');
  rail.append(element('div', 'rail__logo', 'S'));
  rail.append(element('div', 'rail__divider'));

  const groups = options.servers.filter((server) => server.kind === 'group');
  const lobbies = options.servers.filter((server) => server.kind === 'lobby');

  const addButtons = (servers: readonly Server[]) => {
    for (const server of servers) {
      const button = element('button', 'rail__server', server.badge) as HTMLButtonElement;
      button.type = 'button';
      button.title = server.name;
      if (server.id === options.activeServerId) {
        button.classList.add('rail__server--active');
      }
      if (server.kind === 'lobby') {
        button.classList.add('rail__server--lobby');
      }
      button.addEventListener('click', () => options.onPick(server.id));
      rail.append(button);
    }
  };

  addButtons(groups);
  if (lobbies.length > 0) {
    rail.append(element('div', 'rail__divider'));
    rail.append(element('div', 'rail__label', 'Lobbies'));
    addButtons(lobbies);
  }

  rail.append(element('div', 'rail__spacer'));
  const add = element('button', 'rail__add') as HTMLButtonElement;
  add.type = 'button';
  add.title = 'Add a server (not in this demo)';
  add.append(iconNamed('plus', 16));
  rail.append(add);
  return rail;
}

export interface SidebarOptions {
  readonly server: Server;
  readonly groups: readonly ChannelGroup[];
  readonly activeChannelId: string;
  readonly you: string;
  readonly online: readonly string[];
  readonly onPick: (channelId: string) => void;
}

export function renderSidebar(options: SidebarOptions): HTMLElement {
  const sidebar = element('aside', 'sidebar');

  const header = element('header', 'sidebar__header');
  header.append(element('span', 'sidebar__server-name', options.server.name));
  header.append(
    element(
      'span',
      'sidebar__server-kind',
      options.server.kind === 'lobby' ? 'Public lobby' : 'Private group',
    ),
  );
  sidebar.append(header);

  const list = element('div', 'sidebar__channels');
  for (const group of options.groups) {
    list.append(element('h2', 'sidebar__group', group.label));
    for (const channel of group.channels) {
      list.append(renderChannelRow(channel, options.activeChannelId, options.onPick));
    }
  }
  sidebar.append(list);

  const footer = element('footer', 'sidebar__footer');
  const avatar = element('span', 'avatar avatar--you', options.you.slice(0, 1));
  footer.append(avatar);
  footer.append(element('span', 'sidebar__you', options.you));
  footer.append(element('span', 'sidebar__online', `${options.online.length} online`));
  sidebar.append(footer);

  return sidebar;
}

function renderChannelRow(
  channel: Channel,
  activeChannelId: string,
  onPick: (channelId: string) => void,
): HTMLElement {
  const row = element('button', 'channel') as HTMLButtonElement;
  row.type = 'button';
  if (channel.id === activeChannelId) {
    row.classList.add('channel--active');
  }
  if (channel.state === 'finished') {
    row.classList.add('channel--finished');
  }

  const glyph = element('span', 'channel__icon');
  glyph.append(iconNamed(channel.kind === 'text' ? 'hash' : 'dice', 16));
  row.append(glyph);

  const body = element('span', 'channel__body');
  body.append(element('span', 'channel__name', channel.name));
  if (channel.subtitle !== undefined) {
    const subtitle = element('span', 'channel__subtitle', channel.subtitle);
    if (channel.state === 'playing') {
      subtitle.classList.add('channel__subtitle--live');
    }
    body.append(subtitle);
  }
  row.append(body);

  if (channel.state === 'playing') {
    row.append(element('span', 'channel__dot'));
  }

  row.addEventListener('click', () => onPick(channel.id));
  return row;
}

export interface HeaderOptions {
  readonly channel: Channel;
  readonly serverName: string;
  readonly memberCount: number;
  /** Returns to the channel list. Only ever visible on a small screen. */
  readonly onBack: () => void;
}

export function renderHeader(options: HeaderOptions): HTMLElement {
  const header = element('header', 'topbar');

  const back = element('button', 'topbar__back') as HTMLButtonElement;
  back.type = 'button';
  back.setAttribute('aria-label', 'Back to channels');
  back.append(iconNamed('back', 20));
  back.addEventListener('click', options.onBack);
  header.append(back);

  const title = element('div', 'topbar__title');
  const glyph = element('span', 'topbar__icon');
  glyph.append(iconNamed(options.channel.kind === 'text' ? 'hash' : 'dice', 18));
  title.append(glyph);
  title.append(element('span', 'topbar__name', options.channel.name));
  title.append(
    element('span', 'topbar__meta', `${options.serverName} · ${options.memberCount} members`),
  );
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

  const members = element('button', 'iconbutton') as HTMLButtonElement;
  members.type = 'button';
  members.title = 'Members';
  members.append(iconNamed('people', 18));
  actions.append(members);

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

export interface ServerBarOptions {
  readonly servers: readonly Server[];
  readonly activeServerId: string;
  readonly onPick: (serverId: string) => void;
}

/**
 * The server switcher for small screens.
 *
 * Identical content to the rail, laid out for a thumb: a bar across the bottom
 * in portrait, and the same element restyled as a side rail in landscape,
 * where vertical space is the scarce thing. CSS decides which; this only
 * renders the buttons once.
 */
export function renderServerBar(options: ServerBarOptions): HTMLElement {
  const bar = element('nav', 'serverbar');
  bar.setAttribute('aria-label', 'Servers');

  for (const server of options.servers) {
    const button = element('button', 'serverbar__item') as HTMLButtonElement;
    button.type = 'button';
    if (server.id === options.activeServerId) {
      button.classList.add('serverbar__item--active');
      button.setAttribute('aria-current', 'true');
    }

    button.append(element('span', 'serverbar__badge', server.badge));
    button.append(element('span', 'serverbar__name', server.name));
    button.addEventListener('click', () => options.onPick(server.id));
    bar.append(button);
  }

  return bar;
}

export interface SheetOptions {
  /** What the handle says when the sheet is closed: the latest line. */
  readonly summary: string;
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
  handle.append(element('p', 'sheet__latest', options.summary));

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
