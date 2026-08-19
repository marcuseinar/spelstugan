import { describe, expect, it } from 'vitest';
import type { RememberedTable } from './remembered.js';
import {
  MAX_REMEMBERED,
  STORAGE_KEY,
  forgetting,
  nameAt,
  remembering,
  tablesIn,
} from './remembered.js';

const table = (code: string, name = 'Marcus'): RememberedTable => ({ code, name });

describe('STORAGE_KEY', () => {
  // The page shares one storage area with everything else on the origin, so
  // the key has to be both present and ours.
  it('is namespaced to this app', () => {
    expect(STORAGE_KEY).toMatch(/^spelstugan:/);
  });

  it('names what it holds', () => {
    expect(STORAGE_KEY).toContain('tables');
  });
});

describe('remembering', () => {
  it('keeps a table it has just been told about', () => {
    expect(remembering([], table('ABCDE'))).toEqual([table('ABCDE')]);
  });

  it('puts the newest first, since that is the one being played', () => {
    const tables = remembering([table('OLDER')], table('NEWER'));

    expect(tables.map((entry) => entry.code)).toEqual(['NEWER', 'OLDER']);
  });

  it('moves a table already known to the front rather than repeating it', () => {
    const tables = remembering([table('A'), table('B'), table('C')], table('C'));

    expect(tables.map((entry) => entry.code)).toEqual(['C', 'A', 'B']);
  });

  it('takes the newer name when the same table is re-entered', () => {
    const tables = remembering([table('A', 'Marcus')], table('A', 'Alex'));

    expect(tables).toEqual([table('A', 'Alex')]);
  });

  it('keeps the list to its cap', () => {
    const many = Array.from({ length: MAX_REMEMBERED }, (_, index) => table(`CODE${index}`));

    expect(remembering(many, table('NEWEST'))).toHaveLength(MAX_REMEMBERED);
  });

  it('drops the oldest when the cap is reached, not the newest', () => {
    const many = Array.from({ length: MAX_REMEMBERED }, (_, index) => table(`CODE${index}`));
    const tables = remembering(many, table('NEWEST'));

    expect(tables[0]).toEqual(table('NEWEST'));
    expect(tables.map((entry) => entry.code)).not.toContain(`CODE${MAX_REMEMBERED - 1}`);
  });

  it('leaves the list it was given alone', () => {
    const original = [table('A')];
    remembering(original, table('B'));

    expect(original).toEqual([table('A')]);
  });
});

describe('forgetting', () => {
  it('removes the table asked about', () => {
    expect(forgetting([table('A'), table('B')], 'A')).toEqual([table('B')]);
  });

  it('leaves the list alone when the table is not in it', () => {
    expect(forgetting([table('A')], 'ZZZZZ')).toEqual([table('A')]);
  });

  it('empties a list of one', () => {
    expect(forgetting([table('A')], 'A')).toEqual([]);
  });
});

describe('nameAt', () => {
  it('finds the name this browser sat under', () => {
    expect(nameAt([table('A', 'Marcus')], 'A')).toBe('Marcus');
  });

  it('has no name for a table never sat at', () => {
    expect(nameAt([table('A')], 'B')).toBeNull();
  });

  it('has no name when nothing is remembered', () => {
    expect(nameAt([], 'A')).toBeNull();
  });
});

describe('tablesIn', () => {
  it('reads back what was stored', () => {
    expect(tablesIn([{ code: 'A', name: 'Marcus' }])).toEqual([table('A')]);
  });

  it('ignores storage that is not a list at all', () => {
    expect(tablesIn('nonsense')).toEqual([]);
    expect(tablesIn(null)).toEqual([]);
    expect(tablesIn({ code: 'A', name: 'Marcus' })).toEqual([]);
  });

  it('drops entries missing a code or a name', () => {
    expect(tablesIn([{ code: 'A' }, { name: 'Marcus' }, {}, null, 7])).toEqual([]);
  });

  it('drops entries whose code or name is empty', () => {
    expect(
      tablesIn([
        { code: '', name: 'Marcus' },
        { code: 'A', name: '' },
      ]),
    ).toEqual([]);
  });

  it('keeps the good entries beside the bad ones', () => {
    expect(tablesIn([{ code: 'A', name: 'Marcus' }, { nonsense: true }])).toEqual([table('A')]);
  });

  it('caps a stored list that grew too long elsewhere', () => {
    const many = Array.from({ length: MAX_REMEMBERED + 5 }, (_, index) => table(`CODE${index}`));

    expect(tablesIn(many)).toHaveLength(MAX_REMEMBERED);
  });
});
