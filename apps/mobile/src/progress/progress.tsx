import { StatsPill, StatsSheet } from '@slovo/ui';
import { useEffect, useReducer, useState } from 'react';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';
import { useShown } from '../shown-in-effect';

/**
 * The Stats pill (the flame alone while the Streak is hidden), and the stats
 * sheet it opens with the Active Days calendar, both kept up to date while
 * they show, as the reader is shown the statistics.
 */
export function StatsPillAndSheet() {
  const shown = useShown().stats;
  const source = useComposition().progress;
  const progress = useSubscribed(source, ({ state }) => state);
  // A change of the Active Days may leave every number as it was, so any change draws the calendar again.
  const [, changed] = useReducer((version: number) => version + 1, 0);
  useEffect(() => source.subscribe(changed), [source]);
  const [open, setOpen] = useState(false);
  if (shown === undefined) return null;
  return (
    <>
      <StatsPill
        streak={progress.streak}
        hideStreak={!shown.streak}
        onPress={() => {
          setOpen(true);
        }}
      />
      <StatsSheet
        visible={open}
        stats={progress}
        hideStreak={!shown.streak}
        knowledge={shown.knowledge}
        calendar={open ? source.calendar() : []}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
