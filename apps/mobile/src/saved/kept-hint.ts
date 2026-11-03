import { fill, type EditionStrings, type Plural } from '@slovo/contracts';

/**
 * The line under an Entry's action row that says where the Entry is kept
 * (XActions a3), e.g. «У колекції «Осінні слова» · в Улюбленому»: its one
 * Collection by name, several by count, then Favorites. Nothing while the
 * Entry is kept nowhere.
 */
export function keptHint({
  collectionNames,
  inFavorites,
  strings,
  count,
}: {
  /** The names of the Collections the Entry is filed in. */
  collectionNames: readonly string[];
  inFavorites: boolean;
  strings: Pick<EditionStrings, 'collections' | 'favorites'>;
  count: (forms: Plural, count: number) => string;
}): string | undefined {
  const { hint } = strings.collections;
  const [only] = collectionNames;
  const place =
    collectionNames.length > 1
      ? count(hint.many, collectionNames.length)
      : only === undefined
        ? undefined
        : fill(hint.one, { name: only });
  if (place === undefined) return inFavorites ? strings.favorites.hint : undefined;
  return inFavorites ? fill(hint.withFavorites, { place }) : place;
}
