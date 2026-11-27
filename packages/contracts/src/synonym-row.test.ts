import { describe, expect, it } from 'vitest';

import { SynonymRowDominantSchema } from './synonym-row';

/** Where a word of a Synonym Row fails to parse, and why; none when it parses. */
function issuesOf(word: object) {
  return SynonymRowDominantSchema.safeParse(word).error?.issues.map(({ path, message }) => [
    path.join('.'),
    message,
  ]);
}

describe('a word of a Synonym Row', () => {
  it('takes Stress positions in ascending order', () => {
    expect(issuesOf({ text: 'перекотиполе', stress: [3, 10] })).toBeUndefined();
  });

  it('refuses Stress positions out of order or repeated', () => {
    const issues = [['stress', 'Expected Stress positions in ascending order without repeats']];

    expect(issuesOf({ text: 'перекотиполе', stress: [10, 3] })).toEqual(issues);
    expect(issuesOf({ text: 'перекотиполе', stress: [3, 3] })).toEqual(issues);
    expect(issuesOf({ text: 'перекотиполе', stress: [3, 10, 5] })).toEqual(issues);
  });

  it('refuses a text that is not in Unicode NFC', () => {
    expect(issuesOf({ text: 'їжак'.normalize('NFD'), stress: [1] })).toEqual([
      ['text', 'Expected the text in Unicode NFC, with every letter composed'],
    ]);
  });
});
