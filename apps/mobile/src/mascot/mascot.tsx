import type { MascotMoment, MascotState } from '@slovo/contracts';
import { Mascot } from '@slovo/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { edition as shippedEdition } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useShown } from '../shown-in-effect';

/** How long a celebration keeps the Mascot on screen. */
export const CELEBRATION_MS = 4000;

/** The state the Mascot is drawn in at each moment it shows in (ADR 0070). */
const stateAt: Readonly<Record<MascotMoment, MascotState>> = {
  onboarding: 'shouts',
  newLevel: 'celebrates',
  badge: 'celebrates',
  dailyGoal: 'celebrates',
  streakMilestone: 'celebrates',
  gameRight: 'happy',
  gameWrong: 'cringes',
  gameEnd: 'happy',
  empty: 'sleeps',
};

/**
 * The Mascot at the moment `state` with the Edition's line for it, while its
 * Feature Switch is on in effect; else nothing, as in 0.9. `width` sets a
 * smaller figure, such as the Round head's; `onRed` draws it for a red ground.
 */
export function MascotIn({
  state,
  onRed = false,
  width,
}: {
  state: MascotMoment;
  onRed?: boolean;
  width?: number;
}) {
  const edition = useEditionInEffect();
  if (!edition.isFeatureEnabled('mascot')) return null;
  return (
    <Mascot
      state={stateAt[state]}
      line={edition.mascot[state]}
      onRed={onRed}
      testID={`mascot-${state}`}
      {...(width === undefined ? {} : { width })}
    />
  );
}

/**
 * The Mascot in `state` with no line, while its Feature Switch is on in effect;
 * else nothing. `onRed` draws it for a red ground; `width` sets a smaller figure.
 */
export function MascotAs({
  state,
  onRed = false,
  width,
}: {
  state: MascotState;
  onRed?: boolean;
  width?: number;
}) {
  const edition = useEditionInEffect();
  if (!edition.isFeatureEnabled('mascot')) return null;
  return (
    <Mascot
      state={state}
      onRed={onRed}
      testID={`mascot-${state}`}
      {...(width === undefined ? {} : { width })}
    />
  );
}

/**
 * The Mascot in `state` with no line, while its Feature Switch is on in the
 * shipped Edition; else nothing. For the gate of an opening, drawn before the
 * remote Feature Switches are open.
 */
export function ShippedMascot({ state }: { state: MascotState }) {
  if (!shippedEdition.isFeatureEnabled('mascot')) return null;
  return <Mascot state={state} testID={`mascot-${state}`} />;
}

/**
 * The Mascot's celebrations: a new Level, a Badge earned, the Daily Goal met
 * and a Streak milestone each show it for a while over the bottom of the
 * screen. It takes no touch and VoiceOver skips it, so it never interrupts
 * the Feed. Nothing while the reader hides the counters («Без лічильників»,
 * ADR 0066).
 */
export function MascotCelebrations() {
  const { xpLog, badges, progress } = useComposition();
  const { celebrations } = useShown();
  const [shown, setShown] = useState<MascotMoment | undefined>(undefined);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const celebrate = (state: MascotMoment) => {
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
  if (shown === undefined || !celebrations) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.celebration}
    >
      <MascotIn state={shown} />
    </View>
  );
}

const styles = StyleSheet.create({
  celebration: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
