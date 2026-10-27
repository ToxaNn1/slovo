import { useComposition } from '../composition';
import { useSubscribed } from '../opening';
import { useShown } from '../shown-in-effect';

/**
 * The Streak the seventh first-week card shows, or undefined while the reader
 * doesn't see it: the statistics switched off or «Приховати Серію» on.
 */
export function useFirstWeekStreak(): number | undefined {
  const shown = useShown().stats;
  const { streak } = useSubscribed(useComposition().progress, ({ state }) => state);
  return shown?.streak === true ? streak : undefined;
}
