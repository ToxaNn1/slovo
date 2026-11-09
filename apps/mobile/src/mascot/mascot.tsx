import type { MascotMoment, MascotState } from '@slovo/contracts';
import type { BadgeState } from '@slovo/core';
import { BadgeStamp, BadgeToast, fill, Mascot, NewLevelScreen, useRouteOnScreen } from '@slovo/ui';
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { editionStrings, edition as shippedEdition } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useShown } from '../shown-in-effect';

const newLevelStrings = editionStrings.settings.profile.newLevel;
const stampStrings = editionStrings.settings.profile.badgeStamp;

/**
 * A Badge just earned, with the `badgeToast` switch on: toasted in a Game,
 * stamped elsewhere, and stamped bare on the Daily Crossword with the
 * `crosswordBadgeStamp` switch on (board 08.2).
 */
type Earned =
  | { readonly kind: 'toast'; readonly badge: BadgeState }
  | { readonly kind: 'stamp'; readonly badge: BadgeState }
  | { readonly kind: 'crosswordStamp'; readonly badge: BadgeState };

/** A route of a Game, where a Badge earned toasts so the Game goes on. */
const inGame = (route: string | undefined) =>
  route === '/game' || route?.startsWith('/game/') === true;

/** The route of the Daily Crossword, where a Badge of its solves in a row is stamped. */
const CROSSWORD_ROUTE = '/game/crossword';

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
 * smaller figure, such as the Round head's; `onRed` draws it for a red ground,
 * `plate` sets its line on a plate for a Mascot over any screen.
 */
export function MascotIn({
  state,
  onRed = false,
  plate = false,
  width,
}: {
  state: MascotMoment;
  width?: number;
} & ({ onRed?: boolean; plate?: false } | { plate: true; onRed?: false })) {
  const edition = useEditionInEffect();
  if (!edition.isFeatureEnabled('mascot')) return null;
  return (
    <Mascot
      state={stateAt[state]}
      line={edition.mascot[state]}
      {...(plate ? { plate } : { onRed })}
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
 * the Feed. While its Feature Switch is on, a new Level shows the new Level
 * screen instead, until the reader closes it. Nothing while the reader hides
 * the counters («Без лічильників», ADR 0066). With the `badgeToast` switch
 * on, a Badge earned shows its ink toast during a Game and its stamp anywhere
 * else (board 10.7), instead of the Mascot alone; the stamp's «ГОТОВО» opens
 * the Badge, which ends its «НОВА» mark (ADR 0085).
 */
export function MascotCelebrations() {
  const { xpLog, badges, progress } = useComposition();
  const { celebrations } = useShown();
  const edition = useEditionInEffect();
  const [shown, setShown] = useState<MascotMoment | undefined>(undefined);
  const [reached, setReached] = useState<{ level: number; name: string } | undefined>(undefined);
  const [earnedBadge, setEarnedBadge] = useState<Earned | undefined>(undefined);
  const route = useRouteOnScreen();
  const screensNewLevel = useEffectEvent(
    () => celebrations && edition.isFeatureEnabled('newLevelScreen'),
  );
  /**
   * How a Badge just earned shows: toasted or stamped, or with the Mascot
   * alone; a Badge of Daily Crosswords in a row earned on the crossword's
   * screen gets board 08's stamp.
   */
  const badgeShownAs = useEffectEvent((badge: BadgeState): Earned['kind'] | undefined => {
    if (!edition.isFeatureEnabled('badgeToast')) return undefined;
    if (
      route === CROSSWORD_ROUTE &&
      badge.condition.kind === 'dailyCrosswordRun' &&
      edition.isFeatureEnabled('crosswordBadgeStamp')
    )
      return 'crosswordStamp';
    return inGame(route) ? 'toast' : 'stamp';
  });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    const celebrate = (state: MascotMoment) => {
      clearTimeout(timer);
      setShown(state);
      timer = setTimeout(() => {
        setShown(undefined);
      }, CELEBRATION_MS);
    };
    const showBadge = (badge: BadgeState) => {
      const kind = badgeShownAs(badge);
      if (kind === undefined) {
        celebrate('badge');
        return;
      }
      setEarnedBadge({ kind, badge });
      clearTimeout(toastTimer);
      if (kind === 'toast')
        toastTimer = setTimeout(() => {
          setEarnedBadge(undefined);
        }, CELEBRATION_MS);
    };
    const stops = [
      xpLog.onLevelReached(({ level, name }) => {
        if (screensNewLevel()) setReached({ level, name });
        else celebrate('newLevel');
      }),
      xpLog.subscribeGoalMet(() => {
        celebrate('dailyGoal');
      }),
      progress.onStreakMilestone(() => {
        celebrate('streakMilestone');
      }),
      badges.onEarned(showBadge),
    ];
    return () => {
      clearTimeout(timer);
      clearTimeout(toastTimer);
      for (const stop of stops) stop();
    };
  }, [xpLog, badges, progress]);
  if (!celebrations) return null;
  if (reached !== undefined)
    return (
      <NewLevelScreen
        level={reached.level}
        kicker={newLevelStrings.kicker}
        title={fill(newLevelStrings.title, { level: String(reached.level), name: reached.name })}
        doneLabel={newLevelStrings.done}
        mascot={<MascotIn state="newLevel" onRed />}
        onClose={() => {
          setReached(undefined);
        }}
      />
    );
  if (earnedBadge?.kind === 'stamp') {
    const { badge } = earnedBadge;
    return (
      <BadgeStamp
        shape={familyOf(badge)?.shape ?? 'circle'}
        symbol={badge.symbol}
        name={badge.name}
        kicker={stampStrings.kicker}
        line={stampStrings.line}
        ribbon={stampStrings.ribbon}
        doneLabel={stampStrings.done}
        mascot={<MascotAs state="celebrates" onRed />}
        isNew
        onClose={() => {
          setEarnedBadge(undefined);
          void badges.open(badge.id).catch(() => undefined);
        }}
      />
    );
  }
  if (earnedBadge?.kind === 'crosswordStamp') {
    const { badge } = earnedBadge;
    return (
      <BadgeStamp
        shape={familyOf(badge)?.shape ?? 'circle'}
        symbol={badge.symbol}
        name={badge.name}
        kicker={stampKickerOf(badge)}
        line={stampStrings.line}
        doneLabel={stampStrings.done}
        isNew
        onClose={() => {
          setEarnedBadge(undefined);
          void badges.open(badge.id).catch(() => undefined);
        }}
      />
    );
  }
  if (earnedBadge?.kind === 'toast') {
    const { badge } = earnedBadge;
    const family = familyOf(badge);
    return (
      <BadgeToast
        shape={family?.shape ?? 'circle'}
        tone={family?.tone ?? 'ink'}
        symbol={badge.symbol}
        name={badge.name}
        line={stampStrings.line}
      />
    );
  }
  if (shown === undefined) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.celebration}
    >
      {/* The line floats over any screen, so it stands on a plate (owner bug 07.11). */}
      <MascotIn state={shown} plate />
    </View>
  );
}

/** The family of a Badge, from the shipped Edition. */
const familyOf = ({ family }: BadgeState) =>
  shippedEdition.badgeFamilies.find(({ id }) => id === family);

/** The Badge's stamp kicker in the shipped Edition, e.g. «7 ПОСПІЛЬ»; none when it has none. */
const stampKickerOf = ({ id }: BadgeState) =>
  shippedEdition.badges.find((badge) => badge.id === id)?.stampKicker;

const styles = StyleSheet.create({
  celebration: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
