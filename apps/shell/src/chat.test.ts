import { describe, expect, it } from 'vitest';
import { ChatLog, describeGameEvent, messageToSend } from './chat.js';

describe('ChatLog', () => {
  it('starts every channel empty', () => {
    expect(new ChatLog().linesIn('anywhere')).toEqual([]);
  });

  it('keeps lines in the order they were said', () => {
    const log = new ChatLog();
    log.append('general', { kind: 'said', author: 'Alice', text: 'first' });
    log.append('general', { kind: 'said', author: 'Bob', text: 'second' });

    expect(log.linesIn('general').map((line) => line.text)).toEqual(['first', 'second']);
  });

  it('keeps channels apart', () => {
    const log = new ChatLog();
    log.append('general', { kind: 'said', author: 'Alice', text: 'in general' });
    log.append('ludo', { kind: 'said', author: 'Alice', text: 'at the table' });

    expect(log.linesIn('general')).toHaveLength(1);
    expect(log.linesIn('ludo')).toHaveLength(1);
  });

  it('gives every line an id of its own, across channels', () => {
    const log = new ChatLog();
    const first = log.append('general', { kind: 'said', text: 'a' });
    const second = log.append('ludo', { kind: 'said', text: 'b' });
    const third = log.append('general', { kind: 'said', text: 'c' });

    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  });

  it('returns the stored line, with its id', () => {
    const stored = new ChatLog().append('general', { kind: 'said', author: 'Alice', text: 'hi' });

    expect(stored).toEqual({ id: 1, kind: 'said', author: 'Alice', text: 'hi' });
  });

  it('counts what a channel holds', () => {
    const log = new ChatLog();
    log.append('general', { kind: 'said', text: 'a' });
    log.append('general', { kind: 'played', text: 'b' });

    expect(log.countIn('general')).toBe(2);
    expect(log.countIn('elsewhere')).toBe(0);
  });

  it('mixes what was said with what was played, in one timeline', () => {
    const log = new ChatLog();
    log.append('ludo', { kind: 'said', author: 'Alice', text: 'good luck' });
    log.append('ludo', { kind: 'played', author: 'Bob', text: 'rolled 6' });

    expect(log.linesIn('ludo').map((line) => line.kind)).toEqual(['said', 'played']);
  });
});

describe('messageToSend', () => {
  it('passes an ordinary message through', () => {
    expect(messageToSend('hello')).toBe('hello');
  });

  it('trims surrounding whitespace', () => {
    expect(messageToSend('  hello  ')).toBe('hello');
  });

  it('refuses an empty message', () => {
    expect(messageToSend('')).toBeNull();
  });

  it('refuses a message that is only whitespace', () => {
    expect(messageToSend('   \n\t ')).toBeNull();
  });

  it('keeps a message whose only content is punctuation', () => {
    expect(messageToSend('?')).toBe('?');
  });
});

describe('describeGameEvent', () => {
  it('narrates a roll', () => {
    expect(describeGameEvent({ type: 'rolled', playerId: 'Alice', roll: 4 })).toEqual({
      kind: 'played',
      author: 'Alice',
      text: 'rolled 4',
    });
  });

  it('credits a capture to whoever made it, not to the victim', () => {
    const line = describeGameEvent({
      type: 'captured',
      byPlayerId: 'Bob',
      playerId: 'Alice',
      tokenIndex: 2,
    });

    expect(line?.author).toBe('Bob');
    expect(line?.text).toContain('Alice');
  });

  it('narrates a token reaching home', () => {
    expect(describeGameEvent({ type: 'token-home', playerId: 'Carol' })?.text).toBe(
      'got a token home',
    );
  });

  it('narrates an extra turn', () => {
    expect(describeGameEvent({ type: 'extra-turn', playerId: 'Carol' })?.text).toBe('goes again');
  });

  it('narrates having nothing to move', () => {
    expect(describeGameEvent({ type: 'no-legal-move', playerId: 'Dev' })?.text).toBe(
      'had no legal move',
    );
  });

  it('narrates the three-six forfeit', () => {
    expect(describeGameEvent({ type: 'turn-forfeited', playerId: 'Dev' })?.text).toContain(
      'three sixes',
    );
  });

  it('narrates a win', () => {
    expect(describeGameEvent({ type: 'game-won', playerId: 'Alice' })?.text).toBe('won the game');
  });

  it('stays quiet about events not worth mentioning', () => {
    expect(describeGameEvent({ type: 'moved', playerId: 'Alice', tokenIndex: 0 })).toBeNull();
    expect(describeGameEvent({ type: 'turn-ended', playerId: 'Alice' })).toBeNull();
  });

  it('copes with an event carrying no player', () => {
    expect(describeGameEvent({ type: 'rolled', roll: 2 })?.author).toBe('');
  });
});
