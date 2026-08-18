import { describe, expect, it } from 'vitest';
import type { Channel, Server } from './workspace.js';
import { defaultChannelFor, findChannel, findServer, groupChannels } from './workspace.js';

function channel(id: string, overrides: Partial<Channel> = {}): Channel {
  return { id, name: id, kind: 'game', state: 'open', ...overrides };
}

function server(channels: readonly Channel[]): Server {
  return { id: 's', name: 'Server', badge: 'SV', kind: 'group', channels };
}

describe('findServer', () => {
  it('finds a server by id', () => {
    const workspace = { servers: [server([])], you: 'You' };

    expect(findServer(workspace, 's')?.id).toBe('s');
  });

  it('reports nothing for an unknown id', () => {
    const workspace = { servers: [server([])], you: 'You' };

    expect(findServer(workspace, 'missing')).toBeUndefined();
  });
});

describe('findChannel', () => {
  it('finds a channel by id', () => {
    expect(findChannel(server([channel('a'), channel('b')]), 'b')?.id).toBe('b');
  });

  it('reports nothing for an unknown id', () => {
    expect(findChannel(server([channel('a')]), 'zzz')).toBeUndefined();
  });
});

describe('defaultChannelFor', () => {
  it('opens the game in progress ahead of anything else', () => {
    const chosen = defaultChannelFor(
      server([channel('general', { kind: 'text' }), channel('ludo', { state: 'playing' })]),
    );

    expect(chosen?.id).toBe('ludo');
  });

  it('falls back to the first channel when nothing is in play', () => {
    const chosen = defaultChannelFor(
      server([channel('general', { kind: 'text' }), channel('old', { state: 'finished' })]),
    );

    expect(chosen?.id).toBe('general');
  });

  it('never opens a finished game by default', () => {
    const chosen = defaultChannelFor(
      server([channel('done', { state: 'finished' }), channel('waiting', { state: 'open' })]),
    );

    expect(chosen?.id).not.toBe('done');
  });

  it('picks the first of several games in progress', () => {
    const chosen = defaultChannelFor(
      server([channel('one', { state: 'playing' }), channel('two', { state: 'playing' })]),
    );

    expect(chosen?.id).toBe('one');
  });

  it('reports nothing for a server with no channels', () => {
    expect(defaultChannelFor(server([]))).toBeUndefined();
  });
});

describe('groupChannels', () => {
  it('puts text channels first', () => {
    const groups = groupChannels(
      server([channel('ludo', { state: 'playing' }), channel('general', { kind: 'text' })]),
    );

    expect(groups[0]?.label).toBe('Text');
  });

  it('separates games in play from games that ended', () => {
    const groups = groupChannels(
      server([
        channel('general', { kind: 'text' }),
        channel('live', { state: 'playing' }),
        channel('over', { state: 'finished' }),
      ]),
    );

    expect(groups.map((group) => group.label)).toEqual(['Text', 'Game tables', 'Finished']);
  });

  it('keeps a finished game rather than hiding it', () => {
    const groups = groupChannels(server([channel('over', { state: 'finished' })]));

    expect(groups.at(-1)?.channels.map((entry) => entry.id)).toEqual(['over']);
  });

  it('groups an open game with the ones in play', () => {
    const groups = groupChannels(
      server([channel('waiting', { state: 'open' }), channel('live', { state: 'playing' })]),
    );

    expect(groups[0]?.channels).toHaveLength(2);
  });

  it('omits a section with nothing in it', () => {
    const groups = groupChannels(server([channel('general', { kind: 'text' })]));

    expect(groups.map((group) => group.label)).toEqual(['Text']);
  });

  it('produces nothing for an empty server', () => {
    expect(groupChannels(server([]))).toEqual([]);
  });

  it('accounts for every channel exactly once', () => {
    const channels = [
      channel('general', { kind: 'text' }),
      channel('live', { state: 'playing' }),
      channel('waiting', { state: 'open' }),
      channel('over', { state: 'finished' }),
    ];
    const grouped = groupChannels(server(channels)).flatMap((group) => group.channels);

    expect(grouped).toHaveLength(channels.length);
    expect(new Set(grouped.map((entry) => entry.id)).size).toBe(channels.length);
  });
});
