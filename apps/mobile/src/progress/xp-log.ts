import type { DailyGoal } from '@slovo/contracts';
import type { XpLogState } from '@slovo/core';
import { useUndoToast } from '@slovo/ui';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

export type { XpLogState };

/** What the XP log hands over: the XP earned and today's Daily Goal, kept up to date. */
export function useXpLogState(): XpLogState {
  return useSubscribed(useComposition().xpLog, ({ state }) => state);
}

/** Sets today's Daily Goal, or clears it with `null`; a failure is logged. */
export function useSetDailyGoal(): (goal: DailyGoal | null) => void {
  const { xpLog } = useComposition();
  return (goal) => {
    void keep('the Daily Goal', xpLog.setDailyGoal(goal));
  };
}

/**
 * Starts the progress over (ADR 0133) and then says that the words are kept;
 * a failure is logged.
 */
export function useResetProgress(): () => void {
  const { xpLog } = useComposition();
  const showToast = useUndoToast();
  return () => {
    void keep(
      'the Progress reset',
      xpLog.reset().then(() => {
        showToast({ message: editionStrings.settings.progressReset.done });
      }),
    );
  };
}
