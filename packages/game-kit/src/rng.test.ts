import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createRng('session-1:4');
    const second = createRng('session-1:4');

    const draw = (rng: ReturnType<typeof createRng>) =>
      Array.from({ length: 20 }, () => rng.nextInt(6));

    expect(draw(first)).toEqual(draw(second));
  });

  it('produces different sequences for different seeds', () => {
    const first = Array.from({ length: 20 }, () => createRng('session-1:4').nextFloat());
    const second = Array.from({ length: 20 }, () => createRng('session-1:5').nextFloat());

    expect(first).not.toEqual(second);
  });

  describe('nextInt', () => {
    it('stays within range', () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 1, max: 1000 }), (seed, exclusiveMax) => {
          const value = createRng(seed).nextInt(exclusiveMax);
          return Number.isInteger(value) && value >= 0 && value < exclusiveMax;
        }),
      );
    });

    it('always returns zero when the range holds only zero', () => {
      expect(createRng('any').nextInt(1)).toBe(0);
    });

    it.each([0, -1, 2.5, Number.NaN])('rejects %s as a range', (exclusiveMax) => {
      expect(() => createRng('any').nextInt(exclusiveMax)).toThrow(RangeError);
    });

    it('eventually reaches every face of a die', () => {
      const rng = createRng('coverage');
      const seen = new Set(Array.from({ length: 200 }, () => rng.nextInt(6)));

      expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('nextFloat', () => {
    it('stays in [0, 1)', () => {
      fc.assert(
        fc.property(fc.string(), (seed) => {
          const rng = createRng(seed);
          return Array.from({ length: 50 }, () => rng.nextFloat()).every(
            (value) => value >= 0 && value < 1,
          );
        }),
      );
    });
  });

  describe('shuffle', () => {
    it('keeps every item, changing only the order', () => {
      fc.assert(
        fc.property(fc.string(), fc.array(fc.integer(), { maxLength: 40 }), (seed, items) => {
          const shuffled = createRng(seed).shuffle(items);
          return (
            shuffled.length === items.length &&
            [...shuffled].sort((a, b) => a - b).join() === [...items].sort((a, b) => a - b).join()
          );
        }),
      );
    });

    it('does not modify the input', () => {
      const items = [1, 2, 3, 4, 5];
      createRng('seed').shuffle(items);

      expect(items).toEqual([1, 2, 3, 4, 5]);
    });

    it('is deterministic for a given seed', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8];

      expect(createRng('s').shuffle(items)).toEqual(createRng('s').shuffle(items));
    });

    it('returns empty and single-item arrays untouched', () => {
      expect(createRng('s').shuffle([])).toEqual([]);
      expect(createRng('s').shuffle(['only'])).toEqual(['only']);
    });

    it('actually reorders a large enough array', () => {
      const items = Array.from({ length: 30 }, (_, index) => index);

      expect(createRng('reorder').shuffle(items)).not.toEqual(items);
    });
  });
});
