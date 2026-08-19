import { describe, expect, it } from 'vitest';
import type { TableSnapshot } from './api.js';
import {
  chatLinesOf,
  codeInvitedTo,
  invitationTo,
  latestLineOf,
  lobbyStatus,
  millisecondsUntilNextPoll,
  readyToStart,
  rememberedCodeIn,
  seatsFree,
  worthPolling,
} from './table.js';

function table(overrides: Partial<TableSnapshot> = {}): TableSnapshot {
  return {
    code: 'ABCDE',
    gameId: 'ludo',
    seats: 2,
    players: ['Alex'],
    phase: 'lobby',
    finished: false,
    moveCount: 0,
    view: null,
    messages: [],
    ...overrides,
  };
}

function messages(lines: TableSnapshot['messages']): TableSnapshot {
  return table({ messages: lines });
}

describe('invitations', () => {
  it('puts the code in the link', () => {
    expect(invitationTo('https://example.com/spelstugan/', 'ABCDE')).toBe(
      'https://example.com/spelstugan/?table=ABCDE',
    );
  });

  it('replaces a code already in the link, rather than adding a second', () => {
    expect(invitationTo('https://example.com/?table=OLDER', 'ABCDE')).toBe(
      'https://example.com/?table=ABCDE',
    );
  });

  it('keeps other parameters, which are none of its business', () => {
    expect(invitationTo('https://example.com/?theme=dark', 'ABCDE')).toBe(
      'https://example.com/?theme=dark&table=ABCDE',
    );
  });

  it('drops a fragment, which would only confuse the person pasting it', () => {
    expect(invitationTo('https://example.com/#somewhere', 'ABCDE')).toBe(
      'https://example.com/?table=ABCDE',
    );
  });

  it('reads a code back out of a link', () => {
    expect(codeInvitedTo('https://example.com/?table=ABCDE')).toBe('ABCDE');
  });

  it('reads back the code it wrote', () => {
    expect(codeInvitedTo(invitationTo('https://example.com/', 'ABCDE'))).toBe('ABCDE');
  });

  it('finds no code in a plain link', () => {
    expect(codeInvitedTo('https://example.com/')).toBeNull();
  });

  it('finds no code when the parameter is empty', () => {
    expect(codeInvitedTo('https://example.com/?table=')).toBeNull();
  });
});

describe('rememberedCodeIn', () => {
  it('picks the most recent table, which is the one being played', () => {
    expect(rememberedCodeIn([{ code: 'NEWER' }, { code: 'OLDER' }])).toBe('NEWER');
  });

  it('picks nothing when this browser has played nowhere', () => {
    expect(rememberedCodeIn([])).toBeNull();
  });
});

describe('seatsFree', () => {
  it('counts the seats nobody has taken', () => {
    expect(seatsFree(table({ seats: 4, players: ['Alex'] }))).toBe(3);
  });

  it('counts none when everyone is seated', () => {
    expect(seatsFree(table({ seats: 2, players: ['Alex', 'Mia'] }))).toBe(0);
  });

  it('counts every seat at an empty table', () => {
    expect(seatsFree(table({ seats: 2, players: [] }))).toBe(2);
  });

  it('never counts below zero, whatever the server says', () => {
    expect(seatsFree(table({ seats: 1, players: ['Alex', 'Mia'] }))).toBe(0);
  });
});

describe('readyToStart', () => {
  it('is ready once every seat is taken', () => {
    expect(readyToStart(table({ seats: 2, players: ['Alex', 'Mia'] }))).toBe(true);
  });

  it('is not ready with a seat to spare', () => {
    expect(readyToStart(table({ seats: 2, players: ['Alex'] }))).toBe(false);
  });

  it('is not ready at an empty table', () => {
    expect(readyToStart(table({ seats: 2, players: [] }))).toBe(false);
  });

  it('is not ready for a game already under way', () => {
    expect(readyToStart(table({ seats: 2, players: ['Alex', 'Mia'], phase: 'playing' }))).toBe(
      false,
    );
  });
});

describe('lobbyStatus', () => {
  it('says how many are missing', () => {
    expect(lobbyStatus(table({ seats: 4, players: ['Alex'] }))).toBe('Waiting for 3 more players.');
  });

  it('says it in the singular for the last seat', () => {
    expect(lobbyStatus(table({ seats: 2, players: ['Alex'] }))).toBe(
      'Waiting for one more player.',
    );
  });

  it('says the waiting is over when the table is full', () => {
    expect(lobbyStatus(table({ seats: 2, players: ['Alex', 'Mia'] }))).toMatch(/start/i);
  });
});

describe('chatLinesOf', () => {
  it('carries a said line through with its author', () => {
    const table = messages([{ id: 3, kind: 'said', author: 'Alex', text: 'your turn' }]);

    expect(chatLinesOf(table)).toEqual([
      { id: 3, kind: 'said', author: 'Alex', text: 'your turn' },
    ]);
  });

  it('carries a note through without inventing an author for it', () => {
    const table = messages([{ id: 1, kind: 'joined', text: 'Alex sat down' }]);

    // Strictly: a note has no author at all, rather than an empty one. The
    // renderer would survive either, but the type says one of them.
    expect(chatLinesOf(table)).toStrictEqual([{ id: 1, kind: 'joined', text: 'Alex sat down' }]);
  });

  it('keeps the order the table said things in', () => {
    const table = messages([
      { id: 1, kind: 'joined', text: 'Alex sat down' },
      { id: 2, kind: 'said', author: 'Alex', text: 'hello' },
    ]);

    expect(chatLinesOf(table).map((line) => line.id)).toEqual([1, 2]);
  });

  it('has nothing to draw for a table where nothing was said', () => {
    expect(chatLinesOf(table())).toEqual([]);
  });
});

describe('latestLineOf', () => {
  it('shows the newest thing said, with who said it', () => {
    const shown = latestLineOf(
      messages([
        { id: 1, kind: 'said', author: 'Alex', text: 'first' },
        { id: 2, kind: 'said', author: 'Mia', text: 'second' },
      ]),
    );

    expect(shown).toBe('Mia: second');
  });

  it('shows a note as itself, since nobody said it', () => {
    expect(latestLineOf(messages([{ id: 1, kind: 'joined', text: 'The game started' }]))).toBe(
      'The game started',
    );
  });

  it('says so when nothing has been said', () => {
    expect(latestLineOf(table())).toMatch(/no messages/i);
  });
});

describe('worthPolling', () => {
  it('keeps asking about a lobby, since people arrive without warning', () => {
    expect(worthPolling(table({ phase: 'lobby' }))).toBe(true);
  });

  it('keeps asking about a game in progress, since the other side moves', () => {
    expect(worthPolling(table({ phase: 'playing' }))).toBe(true);
  });

  it('stops asking about a finished game, which will never change again', () => {
    expect(worthPolling(table({ phase: 'playing', finished: true }))).toBe(false);
  });

  it('asks about nothing when there is no table', () => {
    expect(worthPolling(null)).toBe(false);
  });
});

describe('millisecondsUntilNextPoll', () => {
  it('checks a lobby often, because somebody is watching the door', () => {
    expect(millisecondsUntilNextPoll(table({ phase: 'lobby' }))).toBe(1500);
  });

  it('checks a game less often, because the waiting player already acted', () => {
    expect(millisecondsUntilNextPoll(table({ phase: 'playing' }))).toBeGreaterThan(
      millisecondsUntilNextPoll(table({ phase: 'lobby' })),
    );
  });
});
