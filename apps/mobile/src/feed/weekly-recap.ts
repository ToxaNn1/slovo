import type { LocalDate, WeeklyRecapModel } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';

/**
 * The numbers of the Weekly Recap of the local day `day`, read once its card
 * is drawn; nothing until they are read, or when the day has no Weekly Recap.
 */
export function useWeeklyRecap(day: LocalDate): WeeklyRecapModel | undefined {
  const { weeklyRecap } = useComposition();
  const [recap, setRecap] = useState<{ of: LocalDate; model: WeeklyRecapModel | undefined }>();
  useEffect(() => {
    let active = true;
    weeklyRecap.of(day).then(
      (model) => {
        if (active) setRecap({ of: day, model });
      },
      (error: unknown) => {
        logError('Could not read the Weekly Recap', error);
      },
    );
    return () => {
      active = false;
    };
  }, [weeklyRecap, day]);
  return recap?.of === day ? recap.model : undefined;
}
