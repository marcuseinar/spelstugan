/**
 * Spelstugan.
 *
 * A table is a code. Open one, send the code, sit down, play — and talk while
 * you do, in the same thread as the play (decision 001). Everything on screen
 * is real: the tables come from the server, the conversation is stored beside
 * the move log, and nothing here is a mockup.
 *
 * The Ludo board is a plugin, handed a container and plain data and nothing
 * else. This file knows how to reach a table; it knows nothing about Ludo.
 */

import { ludoUi } from '@spelstugan/ludo';
import type { LudoMove, LudoShared } from '@spelstugan/ludo';
import { Tables } from './api.js';
import type { TableSnapshot } from './api.js';
import { messageToSend } from './chat.js';
import { afterGesture, canGoBack, toggled } from './navigation.js';
import type { MobileScreen, SheetHeight } from './navigation.js';
import { STORAGE_KEY, forgetting, nameAt, remembering, tablesIn } from './remembered.js';
import type { RememberedTable } from './remembered.js';
import {
  chatLinesOf,
  codeInvitedTo,
  latestLineOf,
  millisecondsUntilNextPoll,
  rememberedCodeIn,
  worthPolling,
} from './table.js';
import './style.css';
import { renderJoining, renderLobby, renderNotice, renderOpening } from './tableView.js';
import {
  element,
  renderChatLines,
  renderComposer,
  renderHeader,
  renderSheetHandle,
  renderSidebar,
} from './view.js';

/**
 * Where the server lives.
 *
 * Overridable at build time so a local Worker can be pointed at while
 * developing; the default is the deployed one, which is public anyway.
 */
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'https://spelstugan.marcus-einar.workers.dev';
const tables = new Tables(SERVER_URL);

let remembered: RememberedTable[] = readRemembered();
let code: string | null = codeInvitedTo(window.location.href) ?? rememberedCodeIn(remembered);
let name = code === null ? '' : (nameAt(remembered, code) ?? '');
let table: TableSnapshot | null = null;
let notice = '';
let pollTimer: number | undefined;

/** Only consulted by the small-screen layout; ignored when everything fits. */
let mobileScreen: MobileScreen = code === null ? 'channels' : 'channel';
let sheetHeight: SheetHeight = 'peek';

function root(): HTMLElement {
  const found = document.getElementById('app');
  if (found === null) {
    throw new Error('The page is missing #app.');
  }
  return found;
}

/* ---- what this browser remembers ---- */

function readRemembered(): RememberedTable[] {
  try {
    return tablesIn(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    // Blocked storage, private browsing, or something unparseable. Starting
    // with an empty list beats refusing to start.
    return [];
  }
}

function writeRemembered(tablesToStore: RememberedTable[]): void {
  remembered = tablesToStore;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tablesToStore));
  } catch {
    // Losing the list on reload is worse than nothing and far better than not
    // playing at all.
  }
}

/* ---- moving around ---- */

function showNewTable(): void {
  stopPolling();
  code = null;
  table = null;
  name = '';
  notice = '';
  mobileScreen = 'channel';
  rememberCodeInUrl(null);
  render();
}

function openTableAt(chosen: string): void {
  stopPolling();
  code = chosen;
  name = nameAt(remembered, chosen) ?? '';
  table = null;
  notice = '';
  mobileScreen = 'channel';
  rememberCodeInUrl(chosen);
  render();
  void refreshTable();
}

function goBack(): void {
  mobileScreen = 'channels';
  render();
}

function moveSheet(height: SheetHeight): void {
  if (height !== sheetHeight) {
    sheetHeight = height;
    render();
  }
}

/** Keeps the address bar honest, so a refresh or a share lands in the right place. */
function rememberCodeInUrl(shown: string | null): void {
  const url = new URL(window.location.href);
  if (shown === null) {
    url.searchParams.delete('table');
  } else {
    url.searchParams.set('table', shown);
  }
  window.history.replaceState(null, '', url.toString());
}

/* ---- talking to the server ---- */

function accept(answer: { ok: boolean; value?: TableSnapshot; reason?: string }): void {
  if (answer.ok && answer.value !== undefined) {
    table = answer.value;
    code = answer.value.code;
    notice = '';
    rememberCodeInUrl(answer.value.code);
  } else {
    notice = answer.reason ?? 'Something went wrong.';
  }
  render();
  schedulePoll();
}

async function openTable(chosenName: string, seats: number): Promise<void> {
  name = chosenName;
  const opened = await tables.open('ludo', seats);
  if (!opened.ok) {
    accept(opened);
    return;
  }
  // Opening a table does not seat you at it — taking a seat does, and the
  // person who opened it wants one too.
  await takeSeat(opened.value.code, chosenName);
}

async function joinTable(chosenName: string): Promise<void> {
  if (code !== null) {
    name = chosenName;
    await takeSeat(code, chosenName);
  }
}

async function takeSeat(at: string, as: string): Promise<void> {
  const seated = await tables.join(at, as);
  if (seated.ok) {
    writeRemembered(remembering(remembered, { code: at, name: as }));
  }
  accept(seated);
}

async function startTable(): Promise<void> {
  if (code !== null) {
    accept(await tables.start(code));
  }
}

async function playMove(move: LudoMove): Promise<void> {
  if (code !== null) {
    accept(await tables.play(code, name, move));
  }
}

async function say(raw: string): Promise<void> {
  const text = messageToSend(raw);
  if (code !== null && text !== null) {
    accept(await tables.say(code, name, text));
  }
}

async function copyInvitation(link: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(link);
    notice = 'Link copied. Send it to whoever is playing.';
  } catch {
    // Clipboard access is refused often enough — an insecure origin, a
    // permission prompt declined — that the link itself is the fallback.
    notice = link;
  }
  render();
}

/**
 * Asks the server again in a moment.
 *
 * Polling stands in for the push transport in `docs/ARCHITECTURE.md`; it is
 * the honest placeholder, not the destination. One timer at a time, cancelled
 * before each new one, so leaving a table stops the asking.
 */
function schedulePoll(): void {
  stopPolling();
  if (table !== null && worthPolling(table)) {
    pollTimer = window.setTimeout(refreshTable, millisecondsUntilNextPoll(table));
  }
}

function stopPolling(): void {
  if (pollTimer !== undefined) {
    window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }
}

async function refreshTable(): Promise<void> {
  if (code === null) {
    return;
  }
  const seen = await tables.read(code, name === '' ? null : name);
  if (seen.ok) {
    table = seen.value;
    render();
  } else if (seen.reason.includes('No table')) {
    // The table is gone — an old code in storage, or a server that has been
    // reset. Say so once and stop asking, rather than blinking an error.
    notice = 'That table is no longer there.';
    writeRemembered(forgetting(remembered, code));
    render();
    return;
  }
  schedulePoll();
}

/* ---- drawing ---- */

function renderMain(): HTMLElement {
  const main = element('main', 'main');
  main.append(renderHeader({ title: headerTitle(), subtitle: headerSubtitle(), onBack: goBack }));
  main.append(renderTablePane());

  if (notice !== '') {
    main.append(renderNotice(notice));
  }
  return main;
}

function headerTitle(): string {
  return code === null ? 'New table' : `Table ${code}`;
}

function headerSubtitle(): string {
  if (table === null) {
    return code === null ? 'Ludo · 2 to 4 players' : 'Finding the table…';
  }
  const seated = `${table.players.length} of ${table.seats} seated`;
  return table.phase === 'lobby' ? seated : `Playing · ${table.players.join(', ')}`;
}

function renderTablePane(): HTMLElement {
  const seatedHere = table?.players.includes(name);

  if (table === null || seatedHere !== true) {
    return code === null
      ? renderOpening({ onOpen: openTable })
      : renderJoining({ code, onJoin: joinTable });
  }
  if (table.phase === 'lobby') {
    return renderLobby({
      table,
      you: name,
      pageUrl: window.location.href,
      onStart: startTable,
      onCopy: copyInvitation,
      onSay: say,
    });
  }
  return renderGame(table);
}

function renderGame(playing: TableSnapshot): HTMLElement {
  const pane = element('div', 'gamepane');

  const boardHost = element('div', 'gamepane__board');
  const view = playing.view as { shared: LudoShared } | null;
  if (view !== null) {
    ludoUi.mount(boardHost, { view, viewerId: name, dispatch: playMove });
  }
  pane.append(boardHost);

  const side = element('div', 'gamepane__chat');
  side.dataset.height = sheetHeight;
  side.append(
    renderSheetHandle({
      summary: latestLineOf(playing),
      unreadHint: 0,
      onGesture: (deltaY) => {
        moveSheet(afterGesture(sheetHeight, deltaY));
      },
      onToggle: () => {
        moveSheet(toggled(sheetHeight));
      },
    }),
  );
  side.append(renderChatLines(chatLinesOf(playing)));
  side.append(renderComposer({ placeholder: 'Message the table…', onSend: say }));
  pane.append(side);

  return pane;
}

function render(): void {
  const app = root();
  // The layout reads these; which of them matters is a CSS decision.
  app.dataset.screen = mobileScreen;
  app.dataset.pane = table?.phase === 'playing' ? 'game' : 'form';
  app.dataset.canGoBack = String(canGoBack(mobileScreen));

  app.replaceChildren(
    renderSidebar({
      tables: remembered,
      activeCode: code,
      onPick: openTableAt,
      onNew: showNewTable,
    }),
    renderMain(),
  );

  // Chat reads newest-last, so keep the latest in view the way a chat app does.
  for (const list of app.querySelectorAll('.chat')) {
    list.scrollTop = list.scrollHeight;
  }
}

render();
if (code !== null) {
  void refreshTable();
}
