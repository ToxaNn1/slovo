import { describe, expect, it } from 'vitest';

import { parseJournal } from './migrate';

/** A drizzle-kit journal with these migrations, each made at its time. */
function journal(...entries: readonly [tag: string, when: number][]): string {
  return JSON.stringify({
    version: '7',
    dialect: 'postgresql',
    entries: entries.map(([tag, when], idx) => ({
      idx,
      version: '7',
      when,
      tag,
      breakpoints: true,
    })),
  });
}

describe('the migration journal', () => {
  it('reads migrations each made after the one before it', () => {
    expect(parseJournal(journal(['0000_a', 1], ['0001_b', 2])).entries).toEqual([
      { tag: '0000_a', when: 1 },
      { tag: '0001_b', when: 2 },
    ]);
  });

  it('refuses a migration made before the one it follows, which drizzle would skip, naming both', () => {
    expect(() => parseJournal(journal(['0000_a', 1], ['0001_b', 3], ['0002_c', 2]))).toThrow(
      '0002_c must be made after 0001_b',
    );
  });

  it('refuses two migrations made at the same time', () => {
    expect(() => parseJournal(journal(['0000_a', 1], ['0001_b', 1]))).toThrow(
      '0001_b must be made after 0000_a',
    );
  });
});
