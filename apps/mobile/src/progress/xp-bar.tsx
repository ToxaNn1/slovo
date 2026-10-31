import { XpBar } from '@slovo/ui';
import { useRouter } from 'expo-router';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';
import { useShown } from '../shown-in-effect';

/**
 * The XP bar over the Feed with today's XP, kept up to date as the XP log
 * grows; a tap opens the Game tab. Left out while the XP log is off or the
 * reader hides the counters.
 */
export function XpBarToGame() {
  const shown = useShown().xpBar;
  const { today } = useSubscribed(useComposition().xpLog, ({ state }) => state);
  const router = useRouter();
  if (!shown) return null;
  return (
    <XpBar
      today={today}
      onPress={() => {
        router.navigate('/game');
      }}
    />
  );
}
