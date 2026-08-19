import { describe, expect, it } from 'vitest';
import { messageToSend } from './chat.js';

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
