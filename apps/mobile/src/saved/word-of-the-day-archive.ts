import type { Composition, WordOfTheDayArchiveDay } from '@slovo/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';

/**
 * The Word of the Day archive «Слова дня», newest first, read each time the
 * screen comes into view, so it holds the days the Feed and the Sync kept
 * since; nothing until the first read ends.
 */
export function useWordOfTheDayArchive(): readonly WordOfTheDayArchiveDay[] | undefined {
  const composition = useComposition();
  const [read, setRead] = useState<{
    in: Composition;
    days: readonly WordOfTheDayArchiveDay[];
  }>();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      composition.wordOfTheDayArchive.list().then(
        (days) => {
          if (active) setRead({ in: composition, days });
        },
        (error: unknown) => {
          logError('Could not read the Word of the Day archive', error);
        },
      );
      return () => {
        active = false;
      };
    }, [composition]),
  );
  // A read of a composition since reopened is not shown.
  return read?.in === composition ? read.days : undefined;
}
