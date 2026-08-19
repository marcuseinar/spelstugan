/**
 * The demo shell: servers, channels, chat, and a real game inside one of them.
 *
 * Everything is in memory and single-player — there is no server yet, so the
 * game is hot seat and the chat only talks to itself. What it does show
 * honestly is the plugin boundary: the Ludo board here is the same
 * `@spelstugan/ludo` UI the standalone playground mounts, handed a container
 * and nothing else.
 */

import { Session } from '@spelstugan/game-kit';
import { ludo, ludoUi } from '@spelstugan/ludo';
import type { LudoMove, LudoSecret, LudoShared } from '@spelstugan/ludo';
import { Tables } from './api.js';
import type { TableSnapshot } from './api.js';
import { ChatLog, describeGameEvent, messageToSend } from './chat.js';
import { HOT_SEAT_NOTE, LUDO_PLAYERS, YOU, onlineNow, seededChat, workspace } from './demoData.js';
import type { MobileScreen, SheetHeight } from './navigation.js';
import {
  afterBack,
  afterGesture,
  afterPickingChannel,
  afterPickingServer,
  canGoBack,
  toggled,
} from './navigation.js';
import './style.css';
import {
  codeInvitedTo,
  latestLineOf,
  millisecondsUntilNextPoll,
  nameKeyFor,
  worthPolling,
} from './table.js';
import {
  renderJoining,
  renderLobby,
  renderNotice,
  renderOpening,
  renderTableChat,
} from './tableView.js';
import {
  element,
  renderChatLines,
  renderComposer,
  renderHeader,
  renderRail,
  renderServerBar,
  renderSheetHandle,
  renderSidebar,
} from './view.js';
import type { Channel, Server } from './workspace.js';
import { defaultChannelFor, findChannel, findServer, groupChannels } from './workspace.js';

const chat = new ChatLog();
for (const [channelId, lines] of Object.entries(seededChat)) {
  for (const line of lines) {
    chat.append(channelId, line);
  }
}

/** One live Ludo game, in the channel that is mid-play. */
const games = new Map<string, Session<LudoShared, LudoSecret, LudoMove>>();

function gameFor(channelId: string): Session<LudoShared, LudoSecret, LudoMove> {
  const existing = games.get(channelId);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Session({ game: ludo, seed: `demo-${channelId}`, players: LUDO_PLAYERS });
  games.set(channelId, created);
  return created;
}

/**
 * Where the real server lives.
 *
 * Overridable at build time so a local Worker can be pointed at while
 * developing; the default is the deployed one, which is public anyway.
 */
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://spelstugan.marcus-einar.workers.dev';
const tables = new Tables(SERVER_URL);

/**
 * The online table, which is the only part of this app that is not pretend.
 *
 * A code with no snapshot yet means someone followed an invitation and has not
 * taken a seat. Following one lands on the table rather than the demo, which
 * is the whole point of sending it.
 */
let onlineCode: string | null = codeInvitedTo(window.location.href);
let showing: 'demo' | 'table' = onlineCode === null ? 'demo' : 'table';
let onlineTable: TableSnapshot | null = null;
let onlineName = '';
let onlineNotice = '';
let pollTimer: number | undefined;

let activeServerId = workspace.servers[0]?.id ?? '';
let activeChannelId = '';
/** Only consulted by the small-screen layout; ignored when everything fits. */
let mobileScreen: MobileScreen = 'channel';
let sheetHeight: SheetHeight = 'peek';

function root(): HTMLElement {
  const found = document.getElementById('app');
  if (found === null) {
    throw new Error('The page is missing #app.');
  }
  return found;
}

/** Re-renders only when the sheet actually moved, so a tap-and-hold is free. */
function moveSheet(height: SheetHeight): void {
  if (height === sheetHeight) {
    return;
  }
  sheetHeight = height;
  render();
}

function selectServer(serverId: string): void {
  activeServerId = serverId;
  const server = findServer(workspace, serverId);
  activeChannelId = server === undefined ? '' : (defaultChannelFor(server)?.id ?? '');
  mobileScreen = afterPickingServer();
  render();
}

function selectChannel(channelId: string): void {
  activeChannelId = channelId;
  mobileScreen = afterPickingChannel();
  render();
}

function goBack(): void {
  mobileScreen = afterBack();
  render();
}

function sendMessage(channelId: string, raw: string): void {
  const text = messageToSend(raw);
  if (text === null) {
    return;
  }
  chat.append(channelId, { kind: 'said', author: YOU, text });
  render();
}

/** The board, plus the table's own chat beside it. */
function renderGameChannel(channel: Channel): HTMLElement {
  const pane = element('div', 'gamepane');
  const boardHost = element('div', 'gamepane__board');
  pane.append(boardHost);

  if (channel.state === 'playing') {
    const session = gameFor(channel.id);
    const { shared } = session.viewFor(null);
    // Hot seat: with no server, the viewer is whoever the rules are waiting on.
    const viewerId = shared.seats[shared.currentSeat]?.playerId ?? YOU;

    ludoUi.mount(boardHost, {
      view: session.viewFor(viewerId),
      viewerId,
      dispatch: (move) => {
        const result = session.attempt(move, viewerId);
        if (!result.accepted) {
          return;
        }
        for (const event of result.events) {
          const line = describeGameEvent(event);
          if (line !== null) {
            chat.append(channel.id, line);
          }
        }
        render();
      },
    });
    // "(you)" follows the hot seat around the table, so say why.
    boardHost.append(element('p', 'hotseat', HOT_SEAT_NOTE));
  } else {
    boardHost.append(renderIdleBoard(channel));
  }

  const lines = chat.linesIn(channel.id);
  const side = element('div', 'gamepane__chat');
  side.dataset.height = sheetHeight;

  side.append(
    renderSheetHandle({
      summary: latestLine(lines),
      unreadHint: 0,
      onGesture: (deltaY) => {
        moveSheet(afterGesture(sheetHeight, deltaY));
      },
      onToggle: () => {
        moveSheet(toggled(sheetHeight));
      },
    }),
  );

  const list = renderChatLines(lines);
  list.classList.add('chat--compact');
  side.append(list);
  side.append(
    renderComposer({
      placeholder: 'Message the table…',
      onSend: (text) => sendMessage(channel.id, text),
    }),
  );
  pane.append(side);

  return pane;
}

/** The most recent thing said or played, for the collapsed sheet. */
function latestLine(lines: readonly { author?: string; text: string }[]): string {
  const last = lines.at(-1);
  if (last === undefined) {
    return 'No messages yet';
  }
  return last.author === undefined ? last.text : `${last.author}: ${last.text}`;
}

/** A game channel that is not in play: finished, or waiting for players. */
function renderIdleBoard(channel: Channel): HTMLElement {
  const card = element('div', 'idle');
  const finished = channel.state === 'finished';

  card.append(
    element('p', 'idle__headline', finished ? 'This game has finished' : 'Waiting for players'),
  );
  card.append(
    element(
      'p',
      'idle__detail',
      finished
        ? 'The conversation stays here. In the real thing you could replay the game move by move, because the move log is the record.'
        : 'In the real thing this table would wait for people to sit down, or you could invite someone by link.',
    ),
  );
  return card;
}

/** A plain text channel: history and a box to type in. */
function renderTextChannel(channel: Channel): HTMLElement {
  const pane = element('div', 'textpane');
  pane.append(renderChatLines(chat.linesIn(channel.id)));
  pane.append(
    renderComposer({
      placeholder: `Message #${channel.name}`,
      onSend: (text) => sendMessage(channel.id, text),
    }),
  );
  return pane;
}

/* ---- the online table: the one part of this app that is not pretend ---- */

/** Leaves the demo behind and opens the real thing. */
function showTableScreen(): void {
  showing = 'table';
  onlineCode = null;
  onlineTable = null;
  onlineNotice = '';
  render();
}

function showDemo(): void {
  stopPolling();
  showing = 'demo';
  onlineCode = null;
  onlineTable = null;
  onlineNotice = '';
  rememberCode(null);
  render();
}

/** Keeps the address bar honest, so a refresh or a share lands in the right place. */
function rememberCode(code: string | null): void {
  const url = new URL(window.location.href);
  if (code === null) {
    url.searchParams.delete('table');
  } else {
    url.searchParams.set('table', code);
  }
  window.history.replaceState(null, '', url.toString());
}

function accept(answer: { ok: boolean; value?: TableSnapshot; reason?: string }): void {
  if (answer.ok && answer.value !== undefined) {
    onlineTable = answer.value;
    onlineCode = answer.value.code;
    onlineNotice = '';
    rememberCode(answer.value.code);
  } else {
    onlineNotice = answer.reason ?? 'Something went wrong.';
  }
  render();
  schedulePoll();
}

async function openTable(name: string, seats: number): Promise<void> {
  onlineName = name;
  const opened = await tables.open('ludo', seats);
  if (!opened.ok) {
    accept(opened);
    return;
  }
  // Opening a table does not seat you at it — taking a seat does, and the
  // person who opened it wants one too.
  await takeSeat(opened.value.code, name);
}

async function joinTable(name: string): Promise<void> {
  if (onlineCode !== null) {
    onlineName = name;
    await takeSeat(onlineCode, name);
  }
}

async function takeSeat(code: string, name: string): Promise<void> {
  const seated = await tables.join(code, name);
  if (seated.ok) {
    rememberName(code, name);
  }
  accept(seated);
}

function rememberName(code: string, name: string): void {
  try {
    window.localStorage.setItem(nameKeyFor(code), name);
  } catch {
    // Private browsing and blocked storage both throw here. Losing the seat on
    // a reload is worse than nothing but far better than not playing at all.
  }
}

function nameRememberedFor(code: string): string {
  try {
    return window.localStorage.getItem(nameKeyFor(code)) ?? '';
  } catch {
    return '';
  }
}

/**
 * Returns to a seat this browser already took.
 *
 * A reload should put a player back at their table, not in front of a join
 * form that will refuse them for using their own name.
 */
async function resumeSeat(code: string): Promise<void> {
  const remembered = nameRememberedFor(code);
  if (remembered === '') {
    return;
  }
  const seen = await tables.read(code, remembered);
  if (seen.ok && seen.value.players.includes(remembered)) {
    onlineName = remembered;
    accept(seen);
  }
}

async function startTable(): Promise<void> {
  if (onlineCode !== null) {
    accept(await tables.start(onlineCode));
  }
}

async function sayAtTable(raw: string): Promise<void> {
  const text = messageToSend(raw);
  if (onlineCode === null || text === null) {
    return;
  }
  accept(await tables.say(onlineCode, onlineName, text));
}

async function playOnline(move: LudoMove): Promise<void> {
  if (onlineCode !== null) {
    accept(await tables.play(onlineCode, onlineName, move));
  }
}

async function refreshTable(): Promise<void> {
  if (onlineCode === null) {
    return;
  }
  const seen = await tables.read(onlineCode, onlineName === '' ? null : onlineName);
  if (seen.ok) {
    onlineTable = seen.value;
    render();
  }
  schedulePoll();
}

/**
 * Asks the server again in a moment.
 *
 * Polling stands in for the push transport the architecture calls for; it is
 * the honest placeholder, not the destination. One timer at a time, cancelled
 * before each new one, so leaving the table stops the asking.
 */
function schedulePoll(): void {
  stopPolling();
  if (!worthPolling(onlineTable) || onlineTable === null) {
    return;
  }
  pollTimer = window.setTimeout(refreshTable, millisecondsUntilNextPoll(onlineTable));
}

function stopPolling(): void {
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }
}

async function copyInvitation(link: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(link);
    onlineNotice = 'Link copied. Send it to whoever is playing.';
  } catch {
    // Clipboard access is refused often enough — an insecure origin, a
    // permission prompt declined — that the link itself is the fallback.
    onlineNotice = link;
  }
  render();
}

function renderOnline(): HTMLElement {
  const pane = onlinePane();
  if (onlineNotice !== '') {
    pane.append(renderNotice(onlineNotice));
  }
  return pane;
}

function onlinePane(): HTMLElement {
  const seatedHere = onlineTable?.players.includes(onlineName);

  if (onlineTable === null || seatedHere !== true) {
    return onlineCode === null
      ? renderOpening({ onOpen: openTable, onLeave: showDemo })
      : renderJoining({ code: onlineCode, onJoin: joinTable, onLeave: showDemo });
  }
  if (onlineTable.phase === 'lobby') {
    return renderLobby({
      table: onlineTable,
      you: onlineName,
      pageUrl: window.location.href,
      onStart: startTable,
      onLeave: showDemo,
      onCopy: copyInvitation,
      onSay: sayAtTable,
    });
  }
  return renderOnlineGame(onlineTable);
}

function renderOnlineGame(table: TableSnapshot): HTMLElement {
  const pane = element('section', 'tablepane tablepane--game');
  pane.append(renderTableBar(`Table ${table.code}`));

  // The same board-and-sheet layout the demo uses, so a phone behaves the same
  // in both: the board keeps the screen and the talk comes up over it.
  const game = element('div', 'gamepane');
  const boardHost = element('div', 'gamepane__board');
  game.append(boardHost);

  const view = table.view as { shared: LudoShared } | null;
  if (view !== null) {
    ludoUi.mount(boardHost, { view, viewerId: onlineName, dispatch: playOnline });
  }

  const side = element('div', 'gamepane__chat');
  side.dataset.height = sheetHeight;
  side.append(
    renderSheetHandle({
      summary: latestLineOf(table),
      unreadHint: 0,
      onGesture: (deltaY) => {
        moveSheet(afterGesture(sheetHeight, deltaY));
      },
      onToggle: () => {
        moveSheet(toggled(sheetHeight));
      },
    }),
  );
  const talk = renderTableChat(table, sayAtTable);
  side.append(...talk.children);
  game.append(side);

  pane.append(game);
  return pane;
}

/** The bar every table screen wears: where you are, and how to leave. */
function renderTableBar(title: string): HTMLElement {
  const bar = element('header', 'tablepane__bar');
  const leave = element('button', 'tablepane__leave', 'Back') as HTMLButtonElement;
  leave.type = 'button';
  leave.addEventListener('click', showDemo);
  bar.append(leave);
  bar.append(element('h2', 'tablepane__title', title));
  return bar;
}

function renderMain(server: Server, channel: Channel): HTMLElement {
  const main = element('main', 'main');
  main.append(
    renderHeader({
      channel,
      serverName: server.name,
      memberCount: onlineNow.length + 1,
      onBack: goBack,
    }),
  );
  main.append(channel.kind === 'game' ? renderGameChannel(channel) : renderTextChannel(channel));
  return main;
}

function render(): void {
  if (showing === 'table') {
    renderTableScreen();
    return;
  }
  renderDemo();
}

/** The real table, on its own: no fake servers, no invented conversation. */
function renderTableScreen(): void {
  const app = root();
  app.dataset.screen = 'table';
  // A table in play is a game channel as far as the layout is concerned, which
  // is what gives it the same sheet behaviour as the demo on a phone.
  app.dataset.channelKind = onlineTable?.phase === 'playing' ? 'game' : 'online';
  app.dataset.canGoBack = 'false';
  app.replaceChildren(renderOnline());

  for (const list of app.querySelectorAll('.chat')) {
    list.scrollTop = list.scrollHeight;
  }
}

function renderDemo(): void {
  const server = findServer(workspace, activeServerId);
  if (server === undefined) {
    return;
  }
  const channel = findChannel(server, activeChannelId) ?? defaultChannelFor(server);
  if (channel === undefined) {
    return;
  }
  activeChannelId = channel.id;

  const app = root();
  // The layout reads these; which of them matters is a CSS decision.
  app.dataset.screen = mobileScreen;
  app.dataset.channelKind = channel.kind;
  app.dataset.canGoBack = String(canGoBack(mobileScreen));

  app.replaceChildren(
    renderRail({
      servers: workspace.servers,
      activeServerId,
      onPick: selectServer,
    }),
    renderSidebar({
      server,
      groups: groupChannels(server),
      activeChannelId,
      you: workspace.you,
      online: onlineNow,
      onPick: selectChannel,
      onPlayForReal: showTableScreen,
    }),
    renderMain(server, channel),
    renderServerBar({
      servers: workspace.servers,
      activeServerId,
      onPick: selectServer,
    }),
  );

  // Chat reads newest-last, so keep the latest in view the way a chat app does.
  for (const list of app.querySelectorAll('.chat')) {
    list.scrollTop = list.scrollHeight;
  }
}

selectServer(activeServerId);

// An invitation link, opened again by someone who already took their seat.
if (onlineCode !== null) {
  void resumeSeat(onlineCode);
}
