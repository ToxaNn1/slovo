import type { DailyGoal } from '@slovo/contracts';
import type { XpLogState } from '@slovo/core';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
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
    xpLog.setDailyGoal(goal).catch((error: unknown) => {
      logError('The Daily Goal could not be set', error);
    });
  };
}
