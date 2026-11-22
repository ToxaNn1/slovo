import type { MascotMoment, MascotState } from '@slovo/contracts';
import type { BadgeState } from '@slovo/core';
import { BadgeStamp, BadgeToast, fill, Mascot, NewLevelScreen, useRouteOnScreen } from '@slovo/ui';
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { editionStrings, edition as shippedEdition } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useGameState } from '../game/game';
import { useShown } from '../shown-in-effect';

const newLevelStrings = editionStrings.settings.profile.newLevel;
const stampStrings = editionStrings.settings.profile.badgeStamp;

/**
 * A Badge just earned: toasted in a Game,
 * stamped elsewhere, and stamped bare on the Daily Crossword with the
 * `crosswordBadgeStamp` switch on (board 08.2).
 */
/** A Daily Goal or Streak milestone told, `told` telling one apart from the one before. */
interface Moment {
  readonly state: MascotMoment;
  readonly told: number;
}

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

/** The state the Mascot is drawn in at each moment it shows in. */
const stateAt: Readonly<Record<MascotMoment, MascotState>> = {
  onboarding: 'shouts',
  newLevel: 'celebrates',
  dailyGoal: 'celebrates',
  streakMilestone: 'celebrates',
  gameRight: 'happy',
  gameWrong: 'cringes',
  empty: 'sleeps',
};

/**
 * The Mascot at the moment `state` with the Edition's line for it, while its
 * Feature Switch is on in effect; else nothing, as in 0.9. `width` sets a
 * smaller figure, such as the Round head's; `onRed` draws it for a red ground,
 * `plate` sets its line on a plate for a Mascot over any screen.
 */
function MascotIn({
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
 * The Mascot's celebrations: a Streak milestone shows it for a while over the
 * bottom of the screen. The Daily Goal met shows it so only while the Feed's
 * goal-reached card is off in effect: the card holds the Mascot otherwise. It
 * takes no touch and
 * VoiceOver skips it, so it never interrupts the Feed. A new Level shows the
 * new Level screen, until the reader closes it. Nothing while the reader hides
 * the counters («Без лічильників», ADR 0066), nor later for what was met then.
 * A Badge earned shows its ink toast during a Game and its stamp anywhere else
 * (board 10.7); the stamp's «ГОТОВО» opens the Badge, which ends its «НОВА»
 * mark. Badges earned at once show in turn; a celebration met under a screen,
 * a stamp or a toast waits for it to close and then has its while.
 */
export function MascotCelebrations() {
  const { xpLog, badges, progress } = useComposition();
  const { celebrations } = useShown();
  const edition = useEditionInEffect();
  const [shown, setShown] = useState<Moment | undefined>(undefined);
  const [reached, setReached] = useState<{ level: number; name: string } | undefined>(undefined);
  // One action can earn several Badges at once: each shows in turn.
  const [earned, setEarned] = useState<readonly Earned[]>([]);
  const route = useRouteOnScreen();
  // What is met while the counters are hidden is never shown later (ADR 0066).
  const celebrates = useEffectEvent(() => celebrations);
  const goalCardOn = useEffectEvent(() => edition.isFeatureEnabled('goalReachedCard'));
  /**
   * How a Badge just earned shows: toasted or stamped; a Badge of Daily
   * Crosswords in a row earned on the crossword's screen gets board 08's stamp.
   */
  const badgeShownAs = useEffectEvent((badge: BadgeState): Earned['kind'] => {
    if (
      route === CROSSWORD_ROUTE &&
      badge.condition.kind === 'dailyCrosswordRun' &&
      edition.isFeatureEnabled('crosswordBadgeStamp')
    )
      return 'crosswordStamp';
    return inGame(route) ? 'toast' : 'stamp';
  });
  useEffect(() => {
    let told = 0;
    const celebrate = (state: MascotMoment) => {
      told += 1;
      if (celebrates()) setShown({ state, told });
    };
    const stops = [
      xpLog.onLevelReached(({ level, name }) => {
        if (celebrates()) setReached({ level, name });
      }),
      xpLog.subscribeGoalMet(() => {
        if (!goalCardOn()) celebrate('dailyGoal');
      }),
      progress.onStreakMilestone(() => {
        celebrate('streakMilestone');
      }),
      badges.onEarned((badge) => {
        if (!celebrates()) return;
        const shownAs: Earned = { kind: badgeShownAs(badge), badge };
        setEarned((queue) => [...queue, shownAs]);
      }),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, [xpLog, badges, progress]);
  const earnedBadge = earned[0];
  const next = () => {
    setEarned((queue) => queue.slice(1));
  };
  if (!celebrations) return null;
  if (reached !== undefined)
    return (
      <NewLevelScreen
        level={reached.level}
        kicker={newLevelStrings.kicker}
        title={fill(newLevelStrings.title, { level: String(reached.level), name: reached.name })}
        line={edition.mascot.newLevel}
        doneLabel={newLevelStrings.done}
        mascot={(width) => <MascotAs state={stateAt.newLevel} onRed width={width} />}
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
          next();
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
          next();
          void badges.open(badge.id).catch(() => undefined);
        }}
      />
    );
  }
  if (earnedBadge?.kind === 'toast')
    return <GameBadgeToast key={earnedBadge.badge.id} badge={earnedBadge.badge} onGone={next} />;
  if (shown === undefined) return null;
  return (
    <CelebrationMoment
      key={shown.told}
      state={shown.state}
      onGone={() => {
        setShown(undefined);
      }}
    />
  );
}

/**
 * A Daily Goal or Streak milestone celebration: it shows for a while from
 * when it comes on screen, after the screen or stamp that covered it closes,
 * then calls `onGone`.
 */
function CelebrationMoment({ state, onGone }: { state: MascotMoment; onGone: () => void }) {
  const gone = useEffectEvent(onGone);
  useEffect(() => {
    const timer = setTimeout(gone, CELEBRATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.celebration}
    >
      {/* The line floats over any screen, so it stands on a plate (owner bug 07.11). */}
      <MascotIn state={state} plate />
    </View>
  );
}

/**
 * The toast of a Badge earned in a Game: it waits while the answer banner
 * shows, so it never hides the banner's verdict (owner check 15.11, item 25),
 * then shows for a while and calls `onGone`.
 */
function GameBadgeToast({ badge, onGone }: { badge: BadgeState; onGone: () => void }) {
  const game = useGameState().current;
  const bannerShown = game?.status === 'answered' && game.banner;
  const gone = useEffectEvent(onGone);
  useEffect(() => {
    if (bannerShown) return;
    const timer = setTimeout(gone, CELEBRATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [bannerShown]);
  if (bannerShown) return null;
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

/** The family of a Badge, from the shipped Edition. */
const familyOf = ({ family }: BadgeState) =>
  shippedEdition.badgeFamilies.find(({ id }) => id === family);

/** The Badge's stamp kicker in the shipped Edition, e.g. «7 ПОСПІЛЬ»; none when it has none. */
const stampKickerOf = ({ id }: BadgeState) =>
  shippedEdition.badges.find((badge) => badge.id === id)?.stampKicker;

const styles = StyleSheet.create({
  celebration: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
