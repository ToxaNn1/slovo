import { dateKeyOf, parseLocalDate, type LocalDate, type WeeklyRecapModel } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';

/**
 * The numbers of the Weekly Recap of the local day `day`, read once its card
 * is drawn; nothing until they are read, or when the day has no Weekly Recap.
 */
export function useWeeklyRecap(day: LocalDate): WeeklyRecapModel | undefined {
  const { weeklyRecap } = useComposition();
  // Keyed on the date, not the object: a new object of the same day reads nothing again.
  const key = dateKeyOf(day);
  const [recap, setRecap] = useState<{ of: string; model: WeeklyRecapModel | undefined }>();
  useEffect(() => {
    let active = true;
    weeklyRecap.of(parseLocalDate(key)).then(
      (model) => {
        if (active) setRecap({ of: key, model });
      },
      (error: unknown) => {
        logError('Could not read the Weekly Recap', error);
      },
    );
    return () => {
      active = false;
    };
  }, [weeklyRecap, key]);
  return recap?.of === key ? recap.model : undefined;
}
