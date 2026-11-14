'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { Streak } from '@slovo/core';
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
 */
export function GameHeader({
  title,
  number,
  roundsPassed,
  roundLimit,
  lives,
  livesAtStart,
  lifeLostAfter,
  streak,
  time,
  onExit,
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
  /** The streak and its record, shown in place of the Rounds passed in a mode with no Round limit. */
  streak: Streak | undefined;
  /** The play time left of a timed Game and its whole time, in milliseconds; none in another Game. */
  time: { left: number; limit: number } | undefined;
  onExit: () => void;
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
  const filled =
    roundLimit === undefined
      ? 0
      : Math.floor((Math.min(roundsPassed, roundLimit) * roundProgress.segments) / roundLimit);
  const hasLives = lives !== undefined && livesAtStart !== undefined;
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <ExitButton onPress={onExit} />
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
        {hasLives && (
          <View
            testID="game-lives"
            accessible
            accessibilityLabel={fill(words.lives, {
              count: String(lives),
              total: String(livesAtStart),
            })}
            {...voice}
            style={styles.lives}
          >
            {Array.from({ length: livesAtStart }, (_, life) => (
              <Life key={life} place={life} full={life < lives} lostAfter={lifeLostAfter} />
            ))}
          </View>
        )}
      </View>
      {roundLimit === undefined && streak !== undefined ? (
        <StreakCounter streak={streak} />
      ) : roundLimit === undefined ? (
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
          {Array.from({ length: roundProgress.segments }, (_, place) => (
            <View
              key={place}
              testID={`game-progress-${String(place)}`}
              style={[
                styles.segment,
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
      )}
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
function ExitButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID="game-exit"
      accessibilityRole="button"
      accessibilityLabel={strings.game.exit.label}
      {...voice}
      onPress={onPress}
      hitSlop={(minTouchTarget - roundHeader.exit) / 2}
      style={[styles.exit, { backgroundColor: colors.surfaceSunken }]}
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
}: {
  place: number;
  full: boolean;
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
      points={wedges.lifeFlag}
      color={color}
      width={roundHeader.life.width}
      height={roundHeader.life.height}
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

/**
 * The streak of «Виживання» (spec #1674): a big counter of the Rounds passed
 * and «{n} поспіль · рекорд {best}» beside it, read by VoiceOver as that line.
 */
function StreakCounter({ streak }: { streak: Streak }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const line = fill(strings.game.round.survivalStreak, {
    n: String(streak.rounds),
    best: String(streak.record),
  });
  return (
    <View
      testID="game-streak"
      accessible
      accessibilityLabel={line}
      {...voice}
      style={styles.streak}
    >
      <Text
        testID="game-streak-rounds"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        style={[typeStyle('roundStreak', tokens), { color: colors.accent }]}
      >
        {streak.rounds}
      </Text>
      <Text
        testID="game-streak-line"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        style={[typeStyle('roundStreakLine', tokens), styles.streakLine, { color: colors.ink }]}
      >
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'baseline', gap: roundLayout.gap },
  streakLine: { flexShrink: 1 },
  // Room under the header, so a scrolled Round slides away clear of it, not against it.
  header: { gap: roundHeader.gap, paddingHorizontal: space[4], paddingBottom: space[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: roundHeader.rowGap },
  title: { flex: 1 },
  segments: { flexDirection: 'row', gap: roundProgress.gap },
  segment: { flex: 1, height: roundProgress.height, transform: [{ skewX: roundProgress.skew }] },
  lives: { flexDirection: 'row', gap: roundHeader.lifeGap },
  exit: {
    width: roundHeader.exit,
    height: roundHeader.exit,
    borderRadius: roundHeader.exitRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
