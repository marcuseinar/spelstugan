/**
 * The world the demo pretends to be in.
 *
 * Invented content, kept plausible rather than impressive: a small group who
 * play together regularly, with a game running and a couple of finished ones
 * behind it. The point is to show what the shell feels like when it is lived
 * in, which an empty state cannot do.
 */

import type { NewChatLine } from './chat.js';
import type { Workspace } from './workspace.js';

export const YOU = 'Alex';
export const LUDO_PLAYERS = [YOU, 'Mia', 'Sam', 'Priya'];

/** Hot seat: with no server, one screen plays every seat. */
export const HOT_SEAT_NOTE = 'Hot seat — this one screen plays every side.';

export const workspace: Workspace = {
  you: YOU,
  servers: [
    {
      id: 'sunday',
      name: 'Sunday Crew',
      badge: 'SC',
      kind: 'group',
      channels: [
        { id: 'general', name: 'general', kind: 'text', state: 'open' },
        {
          id: 'ludo-night',
          name: 'Ludo Night',
          kind: 'game',
          state: 'playing',
          gameId: 'ludo',
          subtitle: 'in progress',
        },
        {
          id: 'ludo-rematch',
          name: 'Ludo Rematch',
          kind: 'game',
          state: 'finished',
          gameId: 'ludo',
          subtitle: 'Sam won · 3 days ago',
        },
        {
          id: 'codenames',
          name: 'Codenames Thursday',
          kind: 'game',
          state: 'finished',
          gameId: 'codenames',
          subtitle: 'Blue won · last week',
        },
      ],
    },
    {
      id: 'offsite',
      name: 'Work Offsite',
      badge: 'WO',
      kind: 'group',
      channels: [
        { id: 'offsite-general', name: 'general', kind: 'text', state: 'open' },
        {
          id: 'offsite-ludo',
          name: 'Lunch Ludo',
          kind: 'game',
          state: 'open',
          gameId: 'ludo',
          subtitle: 'waiting for players',
        },
      ],
    },
    {
      id: 'ludo-lobby',
      name: 'Ludo Arena',
      badge: 'LA',
      kind: 'lobby',
      channels: [
        { id: 'lobby-general', name: 'general', kind: 'text', state: 'open' },
        {
          id: 'lobby-table',
          name: 'Open Table #418',
          kind: 'game',
          state: 'open',
          gameId: 'ludo',
          subtitle: '2 seats free',
        },
      ],
    },
  ],
};

/** History that makes a channel feel used rather than freshly created. */
export const seededChat: Readonly<Record<string, readonly NewChatLine[]>> = {
  general: [
    { kind: 'said', author: 'Sam', text: 'gg last night, that comeback was outrageous' },
    { kind: 'said', author: 'Mia', text: 'I had four tokens in base for twenty minutes. Twenty.' },
    { kind: 'said', author: 'Priya', text: 'rematch tonight? I finish work at 8' },
    { kind: 'said', author: YOU, text: 'works for me' },
    { kind: 'said', author: 'Sam', text: 'started a table — Ludo Night' },
  ],
  'ludo-night': [
    { kind: 'joined', text: 'Sam started this table' },
    { kind: 'joined', text: 'Mia, Priya and You sat down' },
    { kind: 'said', author: 'Priya', text: 'calling blue this time' },
    { kind: 'said', author: 'Mia', text: 'no mercy tonight' },
  ],
  'ludo-rematch': [
    { kind: 'joined', text: 'This game finished 3 days ago' },
    { kind: 'said', author: 'Sam', text: 'told you the corner strategy works' },
    { kind: 'said', author: YOU, text: 'pure luck and you know it' },
  ],
  codenames: [
    { kind: 'joined', text: 'This game finished last week' },
    { kind: 'said', author: 'Mia', text: '"bark" for tree and dog was genuinely good' },
  ],
  'offsite-general': [
    { kind: 'said', author: 'Jonas', text: 'anyone up for a quick one before standup?' },
  ],
  'offsite-ludo': [{ kind: 'joined', text: 'Table open — waiting for players' }],
  'lobby-general': [
    { kind: 'said', author: 'quiet_otter', text: 'gg' },
    { kind: 'said', author: 'dkobayashi', text: 'anyone for ranked?' },
  ],
  'lobby-table': [{ kind: 'joined', text: 'Open table — 2 seats free' }],
};

/** Who is online, for the presence dots in the sidebar footer. */
export const onlineNow = ['Mia', 'Sam', 'Priya'];
