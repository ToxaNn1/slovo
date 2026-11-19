import type { WordOfTheDayArchiveDay } from '@slovo/core';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';

/**
 * The Word of the Day archive «Слова дня», newest first, with the days the
 * Feed and the Sync kept since: the screen draws again only when it changes.
 */
export function useWordOfTheDayArchive(): readonly WordOfTheDayArchiveDay[] {
  return useSubscribed(useComposition().wordOfTheDayArchive, ({ list }) => list);
}

/**
 * The Word of the Day the archive keeps under the local date `YYYY-MM-DD`,
 * once it keeps one: the screen draws again only when that day changes.
 */
export function useWordOfTheDayOn(dateKey: string | undefined): WordOfTheDayArchiveDay | undefined {
  return useSubscribed(useComposition().wordOfTheDayArchive, (archive) =>
    dateKey === undefined ? undefined : archive.day(dateKey),
  );
}
