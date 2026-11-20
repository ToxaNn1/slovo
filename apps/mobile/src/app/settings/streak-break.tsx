import { Redirect } from 'expo-router';

import { StreakBreakScreen } from '@/progress/streak-break-screen';
import { useEditionInEffect } from '@/edition/remote-switches';

/** Settings › Перерва. With the `streakBreak` Feature Switch off in effect it leads back to Settings. */
export default function SettingsStreakBreak() {
  if (!useEditionInEffect().isFeatureEnabled('streakBreak')) return <Redirect href="/settings" />;
  return <StreakBreakScreen />;
}
