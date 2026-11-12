import { describe, expect, it } from 'vitest';

import { categoryFeedPage } from '../index';

const words = ['a', 'b', 'c', 'd'];

describe("a Category's Feed", () => {
  it('opens on the tapped Word, as the first of the Category', () => {
    expect(categoryFeedPage(words, 'c', 0)).toEqual({ entryId: 'c', place: 1, of: 4 });
  });

  it('goes on in Language Pack order and wraps round to the first Word', () => {
    const pages = [1, 2, 3].map((position) => categoryFeedPage(words, 'c', position));
    expect(pages).toEqual([
      { entryId: 'd', place: 2, of: 4 },
      { entryId: 'a', place: 3, of: 4 },
      { entryId: 'b', place: 4, of: 4 },
    ]);
  });

  it('comes back to the tapped Word after the last, endlessly', () => {
    expect(categoryFeedPage(words, 'a', 4)).toEqual({ entryId: 'a', place: 1, of: 4 });
    expect(categoryFeedPage(words, 'a', 4 * 25 + 1)).toEqual({ entryId: 'b', place: 2, of: 4 });
  });

  it('opens on the first Word when the tapped one is no longer in the Category', () => {
    expect(categoryFeedPage(words, 'gone', 0)).toEqual({ entryId: 'a', place: 1, of: 4 });
  });

  it('has no page for a Category with no Words', () => {
    expect(categoryFeedPage([], 'a', 0)).toBeUndefined();
  });
});
