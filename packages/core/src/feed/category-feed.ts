/** A page of a Category's Feed: the Word it shows and its place among the Category's Words. */
export interface CategoryFeedPage {
  readonly entryId: string;
  /** Its place in the Category counted from the tapped Word, from 1 to `of`. */
  readonly place: number;
  /** How many Words the Category has. */
  readonly of: number;
}

/**
 * The page at `position` of a Category's Feed opened on the Word `from`
 * (ADR 0110): the Category's Words in Language Pack order, from `from` on
 * and round again after the last, endlessly. A `from` the Category no longer
 * holds opens on its first Word; a Category with no Words has no page.
 */
export function categoryFeedPage(
  entryIds: readonly string[],
  from: string,
  position: number,
): CategoryFeedPage | undefined {
  const of = entryIds.length;
  const start = Math.max(0, entryIds.indexOf(from));
  const place = position % of;
  const entryId = entryIds[(start + place) % of];
  return entryId === undefined ? undefined : { entryId, place: place + 1, of };
}
