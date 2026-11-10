import { StatsPill, StatsSheet, type MoodDays } from '@slovo/ui';
import { useEffect, useReducer, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';
import { useShown } from '../shown-in-effect';

/**
 * The Stats pill (the flame alone while the Streak is hidden), and the stats
 * sheet it opens with the Active Days calendar, both kept up to date while
 * they show, as the reader is shown the statistics, with the days by Mood
 * counted each time the sheet opens.
 */
export function StatsPillAndSheet() {
  const shown = useShown().stats;
  const source = useComposition().progress;
  const progress = useSubscribed(source, ({ state }) => state);
  // A change of the Active Days may leave every number as it was, so any change draws the calendar again.
  const [, changed] = useReducer((version: number) => version + 1, 0);
  useEffect(() => source.subscribe(changed), [source]);
  const [open, setOpen] = useState(false);
  const mood = useComposition().mood;
  const [moodDays, setMoodDays] = useState<readonly MoodDays[]>([]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    mood
      .daysByMood()
      .then((days) => {
        if (current)
          setMoodDays(mood.moods.map((each) => ({ mood: each, days: days.get(each.id) ?? 0 })));
      })
      .catch((error: unknown) => {
        logError('Could not read the Mood days', error);
      });
    return () => {
      current = false;
    };
  }, [open, mood]);
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
        moodDays={moodDays}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
