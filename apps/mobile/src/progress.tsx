import { StatsPill, StatsSheet } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from './composition';
import { useSubscribed } from './opening';
import { useSettings } from './settings';

/**
 * The Stats pill with the Streak, and the stats sheet it opens, both kept up
 * to date while they show. Where the Streak is drawn is decided here, from the
 * reader's hide-Streak setting.
 */
export function StatsPillAndSheet() {
  const { hideStreak } = useSettings().current;
  const progress = useSubscribed(useComposition().progress, ({ state }) => state);
  const [open, setOpen] = useState(false);
  return (
    <>
      <StatsPill
        streak={progress.streak}
        hideStreak={hideStreak}
        onPress={() => {
          setOpen(true);
        }}
      />
      <StatsSheet
        visible={open}
        stats={progress}
        hideStreak={hideStreak}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
