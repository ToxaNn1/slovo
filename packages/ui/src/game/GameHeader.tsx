'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Wedge } from '../primitives/Wedge';
import { fill, useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import {
  minTouchTarget,
  roundHeader,
  roundLayout,
  roundProgress,
  space,
  typeStyle,
  wedges,
} from '../tokens';
import { GameTimer } from './GameTimer';
import { ease } from './round-motion';

/**
 * A lost Life (board 07's `slPop`) turns to the silhouette as it pops from
 * 0.6 past full size and settles, once the wrong choice has filled, when the
 * Round says the Life is lost, as its haptic does. With Reduce Motion it only
 * fades.
 */
const LIFE_POP_UP = {
  duration: roundHeader.lostPop.duration * 0.6,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
const LIFE_POP_DOWN = {
  duration: roundHeader.lostPop.duration * 0.4,
  easing: ease,
  reduceMotion: ReduceMotion.Never,
};
const LIFE_FADE = { duration: 300, easing: ease, reduceMotion: ReduceMotion.Never };

/**
 * The Round's header (board 07), one for every Game Mode: a row of the ✕,
 * the mode's title in caps with the Round in play out of the Round limit,
 * and the Lives as flags; under it the 10 segments that fill as the Rounds
 * pass towards the limit, or with no limit the Rounds passed, and in a timed
 * Game the timer under them. The flags alone show the Lives, which VoiceOver
 * reads as «Життів: 4 з 5». A mode without Lives shows no flags.
 * On the ground (board «slogo game last») the row is the ✕, the bar and the
 * Lives as hexagons, with no title: the Round shows the mode over its
 * question, «НАГОЛОС · 1/10».
 */
export function GameHeader({
  title,
  number,
  roundsPassed,
  roundLimit,
  lives,
  livesAtStart,
  lifeLostAfter,
  time,
  onExit,
  onGround = false,
}: {
  title: string;
  /** Which Round of the Game is in play, from 1. */
  number: number;
  roundsPassed: number;
  /** The mode's Round limit; none in a mode without one, which shows no bar. */
  roundLimit: number | undefined;
  /** The Lives left; none in a mode without Lives, which shows none. */
  lives: number | undefined;
  /** The Lives the Game started with. */
  livesAtStart: number | undefined;
  /** How long after a wrong answer its Life is lost, in milliseconds. */
  lifeLostAfter: number;
  /** The play time left of a timed Game and its whole time, in milliseconds; none in another Game. */
  time: { left: number; limit: number } | undefined;
  onExit: () => void;
  /** Whether the Round's question stands on the ground: the bar in the row and no title. */
  onGround?: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count } = useEdition();
  const words = strings.game.round;
  const progress = { passed: String(roundsPassed), total: String(roundLimit ?? '') };
  const heading =
    roundLimit === undefined
      ? title
      : fill(words.header, { mode: title, n: String(number), total: String(roundLimit) });
  // On the ground the bar takes a segment per Round (board «slogo game last»), so it agrees with «1/15».
  const segments = onGround && roundLimit !== undefined ? roundLimit : roundProgress.segments;
  const filled =
    roundLimit === undefined
      ? 0
      : Math.floor((Math.min(roundsPassed, roundLimit) * segments) / roundLimit);
  const hasLives = lives !== undefined && livesAtStart !== undefined;
  const livesText = fill(words.lives, { count: String(lives), total: String(livesAtStart) });
  const bar =
    roundLimit === undefined ? (
      <Text
        testID="game-progress"
        accessibilityLabel={fill(words.passedLabel, progress)}
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle('roundLives', tokens), { color: colors.ink }]}
      >
        {fill(words.passed, progress)}
      </Text>
    ) : (
      <View
        testID="game-progress"
        accessible
        accessibilityLabel={fill(words.progressLabel, progress)}
        {...voice}
        style={styles.segments}
      >
        {Array.from({ length: segments }, (_, place) => (
          <View
            key={place}
            testID={`game-progress-${String(place)}`}
            style={[
              styles.segment,
              onGround && styles.segmentOnGround,
              {
                backgroundColor:
                  place < filled
                    ? colors.accent
                    : place === filled
                      ? colors.muted
                      : colors.silhouette,
              },
            ]}
          />
        ))}
      </View>
    );
  const livesShown = hasLives && (
    <View
      testID="game-lives"
      accessible
      accessibilityLabel={livesText}
      {...voice}
      style={[styles.lives, onGround && styles.livesOnGround]}
    >
      {Array.from({ length: livesAtStart }, (_, life) => (
        <Life
          key={life}
          place={life}
          full={life < lives}
          lostAfter={lifeLostAfter}
          onGround={onGround}
        />
      ))}
    </View>
  );
  return (
    <View style={[styles.header, onGround && styles.headerOnGround]}>
      <View style={styles.headerRow}>
        <ExitButton onPress={onExit} onGround={onGround} />
        {onGround ? (
          <View style={styles.barInRow}>{bar}</View>
        ) : (
          <Text
            testID="game-title"
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={roundHeader.titleMinScale}
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            {...voice}
            style={[typeStyle('roundTitle', tokens), styles.title, { color: colors.ink }]}
          >
            {heading}
          </Text>
        )}
        {livesShown}
      </View>
      {!onGround && bar}
      {time !== undefined && (
        <GameTimer
          remainingMs={time.left}
          totalMs={time.limit}
          texts={{
            remaining: (seconds) => count(words.timer, seconds),
            shown: (seconds) => fill(words.timerShown, { seconds: String(seconds) }),
          }}
          testID="game-timer"
        />
      )}
    </View>
  );
}

/**
 * The ✕ at the start of the Round's header (board 07), a 40-pt square, which
 * VoiceOver reads as the Edition's «Вийти з гри».
 */
function ExitButton({ onPress, onGround }: { onPress: () => void; onGround: boolean }) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID="game-exit"
      accessibilityRole="button"
      accessibilityLabel={strings.game.exit.label}
      {...voice}
      onPress={onPress}
      hitSlop={Math.max(0, (minTouchTarget - (onGround ? GROUND.exit : roundHeader.exit)) / 2)}
      style={[
        styles.exit,
        onGround && styles.exitOnGround,
        { backgroundColor: colors.surfaceSunken },
      ]}
    >
      <Svg width={roundHeader.exitGlyph} height={roundHeader.exitGlyph} viewBox="0 0 14 14">
        <Path d="M0 2L2 0L7 5L12 0L14 2L9 7L14 12L12 14L7 9L2 14L0 12L5 7Z" fill={colors.ink} />
      </Svg>
    </Pressable>
  );
}

/**
 * One Life, a flag: red while full, the silhouette once lost. A Life lost
 * meanwhile turns grey as it pops; with Reduce Motion its fill only fades.
 * Its haptic comes with the wrong answer that cost it.
 */
function Life({
  place,
  full,
  lostAfter,
  onGround,
}: {
  place: number;
  full: boolean;
  /** Whether it stands in the header on the ground, a hexagon (board «slogo game last»), not a flag. */
  onGround: boolean;
  /** How long after the wrong answer the Life is lost, in milliseconds: when it pops. */
  lostAfter: number;
}) {
  const { colors } = useTokens();
  const reduceMotion = useReduceMotion();
  /** 1 while full, 0 once lost. */
  const fullness = useSharedValue(full ? 1 : 0);
  const scale = useSharedValue(1);
  // Whether the Life showed full before, so only losing it now pops.
  const shownFull = useRef(full);

  useEffect(() => {
    if (full) {
      shownFull.current = true;
      fullness.value = 1;
      return;
    }
    if (!shownFull.current) return;
    shownFull.current = false;
    fullness.value = withDelay(lostAfter, withTiming(0, reduceMotion ? LIFE_FADE : LIFE_POP_UP));
    if (!reduceMotion) {
      scale.value = withDelay(
        lostAfter,
        withSequence(
          withTiming(roundHeader.lostPop.from, { duration: 0 }),
          withTiming(roundHeader.lostPop.peak, LIFE_POP_UP),
          withTiming(1, LIFE_POP_DOWN),
        ),
      );
    }
    // The shared values are stable, and a change of Reduce Motion finds the
    // Life already lost.
  }, [full, reduceMotion, lostAfter, fullness, scale]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fullness.value }));

  const flag = (color: string) => (
    <Wedge
      points={onGround ? wedges.lifeHex : wedges.lifeFlag}
      color={color}
      width={onGround ? GROUND.life.width : roundHeader.life.width}
      height={onGround ? GROUND.life.height : roundHeader.life.height}
    />
  );
  return (
    <Animated.View testID={`game-life-${String(place)}`} style={popStyle}>
      {flag(colors.silhouette)}
      <Animated.View
        testID={`game-life-${String(place)}-fill`}
        style={[StyleSheet.absoluteFill, fillStyle]}
      >
        {flag(colors.accent)}
      </Animated.View>
    </Animated.View>
  );
}

const GROUND = roundHeader.ground;

const styles = StyleSheet.create({
  // Room under the header, so a scrolled Round slides away clear of it, not against it.
  header: { gap: roundHeader.gap, paddingHorizontal: space[4], paddingBottom: space[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: roundHeader.rowGap },
  title: { flex: 1 },
  segments: { flexDirection: 'row', gap: roundProgress.gap },
  segment: { flex: 1, height: roundProgress.height, transform: [{ skewX: roundProgress.skew }] },
  lives: { flexDirection: 'row', gap: roundHeader.lifeGap },
  livesOnGround: { gap: GROUND.lifeGap },
  segmentOnGround: { height: GROUND.segmentHeight },
  headerOnGround: { paddingBottom: 0 },
  barInRow: { flex: 1, justifyContent: 'center' },
  exitOnGround: { width: GROUND.exit, height: GROUND.exit, borderRadius: GROUND.exitRadius },
  exit: {
    width: roundHeader.exit,
    height: roundHeader.exit,
    borderRadius: roundHeader.exitRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
