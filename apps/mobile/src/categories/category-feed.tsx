import type { Category } from '@slovo/contracts';
import { categoryFeedPage, type Composition } from '@slovo/core';
import { useCallback } from 'react';

import { editionStrings } from '../edition/edition';
import { ListFeedScreen, readCards, type ListFeedRead } from './list-feed';

/** A Category's live Words, in the Language Pack's order, opened on `from`. */
async function readWords(
  composition: Composition,
  category: Category,
  from: string,
): Promise<ListFeedRead> {
  const entryIds = (await composition.categoryEntries('word', category.id)).map(({ id }) => id);
  return {
    name: category.displayName,
    pageAt: (position) => categoryFeedPage(entryIds, from, position),
    cards: await readCards(composition, entryIds),
  };
}

/**
 * A Category's Feed (ADR 0110): the Category's live Words alone, from the
 * Word tapped on its screen on in the Language Pack's order and round again
 * after the last, endlessly, each card's kicker naming its place,
 * «Категорія · Емоції · 2 з 4». It makes nothing Seen; its back tile, named
 * for the Category, returns to the Category's screen.
 */
export function CategoryFeedScreen({ category, from }: { category: Category; from: string }) {
  const read = useCallback(
    (open: Composition) => readWords(open, category, from),
    [category, from],
  );
  return (
    <ListFeedScreen
      read={read}
      failure="Could not read the Words of a Category"
      kicker={editionStrings.dashboard.category.feedKicker}
      testID="category-feed"
    />
  );
}
