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
  const created = new Session(ludo, `demo-${channelId}`, LUDO_PLAYERS);
  games.set(channelId, created);
  return created;
}

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
