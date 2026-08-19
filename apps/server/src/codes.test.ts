import { createRng } from '@spelstugan/game-kit';
import { describe, expect, it } from 'vitest';
import { CODE_LENGTH, createCode, normalizeCode } from './codes.js';

describe('createCode', () => {
  it('makes a code of the agreed length', () => {
    expect(createCode(createRng('seed'))).toHaveLength(CODE_LENGTH);
  });

  it('makes a code that reads back as valid', () => {
    const code = createCode(createRng('seed'));

    expect(normalizeCode(code)).toBe(code);
  });

  it('uses no character people confuse for another', () => {
    const codes = Array.from({ length: 200 }, (_, index) => createCode(createRng(`seed-${index}`)));

    expect(codes.join('')).not.toMatch(/[OIL01]/);
  });

  it('makes a different code from a different seed', () => {
    expect(createCode(createRng('one'))).not.toBe(createCode(createRng('two')));
  });

  it('makes the same code from the same seed, since the rng is deterministic', () => {
    expect(createCode(createRng('same'))).toBe(createCode(createRng('same')));
  });
});

describe('normalizeCode', () => {
  it('accepts a code as typed', () => {
    expect(normalizeCode('ABCDE')).toBe('ABCDE');
  });

  it('accepts a code typed in lower case', () => {
    expect(normalizeCode('abcde')).toBe('ABCDE');
  });

  it('accepts a code with space around it', () => {
    expect(normalizeCode('  ABCDE ')).toBe('ABCDE');
  });

  it('rejects a code that is too short', () => {
    expect(normalizeCode('ABCD')).toBeNull();
  });

  it('rejects a code that is too long', () => {
    expect(normalizeCode('ABCDEF')).toBeNull();
  });

  it('rejects an empty code', () => {
    expect(normalizeCode('')).toBeNull();
  });

  it('rejects a character outside the alphabet', () => {
    expect(normalizeCode('ABCD!')).toBeNull();
  });

  it('rejects the characters left out for being confusable', () => {
    expect(normalizeCode('ABCDO')).toBeNull();
    expect(normalizeCode('ABCD1')).toBeNull();
  });
});
