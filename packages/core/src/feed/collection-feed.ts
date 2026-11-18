import type { CuratedCollectionScreen } from '../dashboard/curated-collections';
import { categoryFeedPage, type CategoryFeedPage } from './category-feed';

/**
 * The page at `position` of a Curated Collection's Feed opened on the Entry
 * `from`: the Category Feed's paging (ADR 0110) over the Entries its screen
 * shows, of any kind, neither Retired nor Hidden, in its order, from `from`
 * on and round again after the last, endlessly. `place` of `of` is its «k з n».
 * Open each page's card with `entryCard`, which makes nothing Seen and leaves
 * History as it was. A `from` the screen no longer shows opens on its first
 * Entry; a screen with no Entries has no page.
 */
export function collectionFeedPage(
  screen: Pick<CuratedCollectionScreen, 'entries'>,
  from: string,
  position: number,
): CategoryFeedPage | undefined {
  return categoryFeedPage(
    screen.entries.map(({ entryId }) => entryId),
    from,
    position,
  );
}
