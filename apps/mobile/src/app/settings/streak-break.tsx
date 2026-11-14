import { Redirect } from 'expo-router';

import { StreakBreakScreen } from '@/progress/streak-break-screen';
import { useShown } from '@/shown-in-effect';

/** Settings › Перерва. With the `streakBreak` Feature Switch off in effect it leads back to Settings. */
export default function SettingsStreakBreak() {
  if (!useShown().streakBreak) return <Redirect href="/settings" />;
  return <StreakBreakScreen />;
}
