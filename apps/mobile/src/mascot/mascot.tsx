import type { MascotState } from '@slovo/contracts';
import { Mascot } from '@slovo/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { useEditionInEffect } from '../edition/remote-switches';

/** How long a celebration keeps the Mascot on screen. */
export const CELEBRATION_MS = 4000;

/** The Mascot in `state` with the Edition's line for it, while its Feature Switch is on in effect; else nothing, as in 0.9. */
export function MascotIn({ state }: { state: MascotState }) {
  const edition = useEditionInEffect();
  if (!edition.isFeatureEnabled('mascot')) return null;
  return <Mascot state={state} line={edition.mascot[state]} />;
}

/**
 * The Mascot's celebrations: a new Level, a Badge earned, the Daily Goal met
 * and a Streak milestone each show it for a while over the bottom of the
 * screen. It takes no touch, so it never interrupts the Feed.
 */
export function MascotCelebrations() {
  const { xpLog, badges, progress } = useComposition();
  const [shown, setShown] = useState<MascotState | undefined>(undefined);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const celebrate = (state: MascotState) => {
      clearTimeout(timer);
      setShown(state);
      timer = setTimeout(() => {
        setShown(undefined);
      }, CELEBRATION_MS);
    };
    let level = xpLog.state.level?.level ?? 0;
    let earned = new Set(badges.state.filter((badge) => badge.earned).map(({ id }) => id));
    const stops = [
      xpLog.subscribe(() => {
        const next = xpLog.state.level?.level ?? 0;
        if (next > level) celebrate('newLevel');
        level = next;
      }),
      xpLog.subscribeGoalMet(() => {
        celebrate('dailyGoal');
      }),
      progress.onStreakMilestone(() => {
        celebrate('streakMilestone');
      }),
      badges.subscribe(() => {
        const now = badges.state.filter((badge) => badge.earned).map(({ id }) => id);
        if (now.some((id) => !earned.has(id))) celebrate('badge');
        earned = new Set(now);
      }),
    ];
    return () => {
      clearTimeout(timer);
      for (const stop of stops) stop();
    };
  }, [xpLog, badges, progress]);
  if (shown === undefined) return null;
  return (
    <View pointerEvents="none" style={styles.celebration}>
      <MascotIn state={shown} />
    </View>
  );
}

const styles = StyleSheet.create({
  celebration: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
