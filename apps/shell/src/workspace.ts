/**
 * The shape of the social layer: servers, channels, and which one you're in.
 *
 * This mirrors the domain model in `docs/ARCHITECTURE.md` — Server, Channel,
 * Session — deliberately, so the demo shell is a sketch of the real thing
 * rather than a lookalike that would have to be thrown away. Nothing here
 * persists; the demo holds it in memory.
 */

export type ChannelKind = 'text' | 'game';

/** Where a game channel is in its life. Text channels are always `open`. */
export type ChannelState = 'open' | 'playing' | 'finished';

export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly kind: ChannelKind;
  readonly state: ChannelState;
  /** For game channels: which game plugin runs here. */
  readonly gameId?: string;
  /** Shown under the channel name — whose turn, or how it ended. */
  readonly subtitle?: string;
  /**
   * Reserved by decision 004 so a channel can later become a session inside a
   * persistent channel without a migration. Unused today, deliberately.
   */
  readonly parentChannelId?: string | null;
}

export interface Server {
  readonly id: string;
  readonly name: string;
  /** Two letters for the rail; the real thing would use an icon. */
  readonly badge: string;
  /** A global per-game lobby, or a private group. Both are servers (decision 007). */
  readonly kind: 'group' | 'lobby';
  readonly channels: readonly Channel[];
}

export interface Workspace {
  readonly servers: readonly Server[];
  readonly you: string;
}

export function findServer(workspace: Workspace, serverId: string): Server | undefined {
  return workspace.servers.find((server) => server.id === serverId);
}

export function findChannel(server: Server, channelId: string): Channel | undefined {
  return server.channels.find((channel) => channel.id === channelId);
}

/**
 * The channel to open when a server is selected.
 *
 * A game in progress is what you most likely came back for, so it wins.
 * Otherwise take the first channel that has not already ended — landing
 * someone in a finished game is the one clearly wrong answer. Only if
 * everything is finished does the first channel win by default.
 */
export function defaultChannelFor(server: Server): Channel | undefined {
  const inPlay = server.channels.find((channel) => channel.state === 'playing');
  const stillOpen = server.channels.find((channel) => channel.state !== 'finished');
  return inPlay ?? stillOpen ?? server.channels[0];
}

/** Channels grouped for the sidebar, in display order. */
export interface ChannelGroup {
  readonly label: string;
  readonly channels: readonly Channel[];
}

/**
 * Splits a server's channels into the sidebar's sections.
 *
 * Finished games are kept apart rather than hidden: the record of what you
 * played with these people is the point (decision 001), but it should not
 * compete with the game that is live right now.
 */
export function groupChannels(server: Server): readonly ChannelGroup[] {
  const text = server.channels.filter((channel) => channel.kind === 'text');
  const active = server.channels.filter(
    (channel) => channel.kind === 'game' && channel.state !== 'finished',
  );
  const finished = server.channels.filter(
    (channel) => channel.kind === 'game' && channel.state === 'finished',
  );

  const groups: ChannelGroup[] = [];
  if (text.length > 0) {
    groups.push({ label: 'Text', channels: text });
  }
  if (active.length > 0) {
    groups.push({ label: 'Game tables', channels: active });
  }
  if (finished.length > 0) {
    groups.push({ label: 'Finished', channels: finished });
  }
  return groups;
}
