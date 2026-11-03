import { describe, expect, it } from 'vitest';

import { keptHint } from './kept-hint';
import { count, strings } from '../test-support';

const hint = (collectionNames: readonly string[], inFavorites: boolean) =>
  keptHint({ collectionNames, inFavorites, strings, count });

describe('keptHint', () => {
  it('says nothing while the Entry is kept nowhere', () => {
    expect(hint([], false)).toBeUndefined();
  });

  it('names the one Collection the Entry is in', () => {
    expect(hint(['Осінні слова'], false)).toBe('У колекції «Осінні слова»');
  });

  it('counts the Collections when the Entry is in several', () => {
    expect(hint(['Осінні слова', 'Для есе'], false)).toBe('У 2 колекціях');
  });

  it('says Favorites alone when the Entry is in no Collection', () => {
    expect(hint([], true)).toBe('В Улюбленому');
  });

  it('adds Favorites after the Collections', () => {
    expect(hint(['Осінні слова'], true)).toBe('У колекції «Осінні слова» · в Улюбленому');
  });
});
