import { StatsPill, StatsSheet } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from './composition';
import { useEditionInEffect } from './edition/remote-switches';
import { useSubscribed } from './opening';
import { progressShownOf } from './progress-shown';
import { useSettings } from './settings';

/**
 * The Stats pill with the Streak, and the stats sheet it opens, both kept up
 * to date while they show. What is drawn is decided here, from the statistics
 * switch in effect and the reader's hide-Streak setting.
 */
export function StatsPillAndSheet() {
  const shown = progressShownOf(useEditionInEffect(), useSettings().current);
  const progress = useSubscribed(useComposition().progress, ({ state }) => state);
  const [open, setOpen] = useState(false);
  if (!shown.statistics) return null;
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
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
