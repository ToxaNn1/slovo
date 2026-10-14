import type { ProgressState } from '@slovo/core';
import { StatsPill, StatsSheet } from '@slovo/ui';
import { useState } from 'react';

import { useComposed } from './composition';

/** The progress, kept up to date; nothing until the composition is open. */
function useProgress(): ProgressState | undefined {
  return useComposed(
    (composition) => composition.progress,
    (progress) => progress.state,
    undefined,
  );
}

/**
 * The Stats pill with the Streak, and the stats sheet it opens, both kept up
 * to date while they show; nothing until the composition is open.
 */
export function StatsPillAndSheet() {
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  if (progress === undefined) return null;
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
