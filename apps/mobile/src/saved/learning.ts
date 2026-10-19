import { daysUntil, type Knowledge, type LearningEntry } from '@slovo/core';
import type { LearningItem } from '@slovo/ui';
import { useEffect, useMemo, useState } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';

/**
 * The Entries the reader is learning, the next Review first, each with how
 * many local days until it (ADR 0043), kept up to date with every Knowledge
 * Mark. None with the knowledge Feature Switch off.
 */
export function useLearningList(): readonly LearningItem[] {
  const { knowledge } = useComposition();
  // Kept with the Knowledge it came from, so a reopened composition never shows the old list.
  const [listed, setListed] = useState<{ in: Knowledge; list: readonly LearningEntry[] }>();

  useEffect(() => {
    let latest = 0;
    let open = true;
    const load = () => {
      // Only the last change's list is shown, whichever reads its rows first.
      const call = ++latest;
      knowledge.learning().then(
        (list) => {
          if (open && call === latest) setListed({ in: knowledge, list });
        },
        (error: unknown) => {
          console.error('Could not list the Entries being learned', error);
        },
      );
    };
    load();
    const stop = knowledge.subscribe(load);
    return () => {
      open = false;
      stop();
    };
  }, [knowledge]);

  const list = listed?.in === knowledge ? listed.list : undefined;
  return useMemo(
    () =>
      (list ?? []).map(({ row, reviewDay }) => ({
        row,
        daysUntilReview: daysUntil(reviewDay, deviceClock),
      })),
    [list],
  );
}
