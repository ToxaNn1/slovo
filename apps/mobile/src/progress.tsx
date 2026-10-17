import { StatsPill, StatsSheet } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from './composition';
import { useSubscribed } from './opening';

/**
 * The Stats pill with the Streak, and the stats sheet it opens, both kept up
 * to date while they show.
 */
export function StatsPillAndSheet() {
  const progress = useSubscribed(useComposition().progress, ({ state }) => state);
  const [open, setOpen] = useState(false);
  return (
    <>
      <StatsPill
        streak={progress.streak}
        onPress={() => {
          setOpen(true);
        }}
      />
      <StatsSheet
        visible={open}
        stats={progress}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
