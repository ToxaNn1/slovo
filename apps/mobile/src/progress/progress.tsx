import { StatsPill, StatsSheet } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';
import { useShown } from '../shown-in-effect';

/**
 * The Stats pill (the flame alone while the Streak is hidden), and the stats
 * sheet it opens, both kept up to date while they show, as the reader is shown
 * the statistics.
 */
export function StatsPillAndSheet() {
  const shown = useShown().stats;
  const progress = useSubscribed(useComposition().progress, ({ state }) => state);
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
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
