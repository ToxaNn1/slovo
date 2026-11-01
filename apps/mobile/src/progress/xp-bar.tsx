import { XpBar } from '@slovo/ui';
import { useRouter } from 'expo-router';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';
import { useShown } from '../shown-in-effect';

/**
 * The XP bar over the Feed with today's XP over the Daily Goal while it is
 * on, kept up to date as the XP log grows; a tap opens the Game tab. Left out while the XP log is off or the
 * reader hides the counters.
 */
export function XpBarToGame() {
  const shown = useShown();
  const { today, dailyGoal } = useSubscribed(useComposition().xpLog, ({ state }) => state);
  const router = useRouter();
  if (!shown.xpBar) return null;
  return (
    <XpBar
      today={today}
      goal={shown.dailyGoal ? dailyGoal?.goal : undefined}
      onPress={() => {
        router.navigate('/game');
      }}
    />
  );
}
