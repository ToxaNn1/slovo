'use no memo';

import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { fontScaleCap, gameTimerLayout, roundLayout, roundProgress, typeStyle } from '../tokens';

/** VoiceOver reads the time left each time this many seconds pass. */
const ANNOUNCE_EVERY = 10;

/** The whole seconds left, counted up, so the timer reads 0 only once the time is up. */
const secondsLeft = (remainingMs: number) => Math.max(0, Math.ceil(remainingMs / 1000));

/**
 * A timed Game's countdown in its own row under the Round's header: one
 * solid slanted bar whose accent empties as the time runs out (board 06 «На
 * час»), then the seconds left, such as «60 с», drawn from the time left the
 * Core gives. While the clock runs the bar empties on the UI thread at an
 * even pace, so the screen need tick only each whole second (27.11 pass: a
 * bar drawn from the ticks crawled in steps); paused or under Reduce Motion it
 * stands at the time left. VoiceOver
 * reads the time left each time ten seconds pass, once even when the time
 * jumps over a ten, and never at none. The screen ticks the time and pauses
 * it, and passes the Edition's texts.
 */
export function GameTimer({
  remainingMs,
  totalMs,
  running,
  texts,
  testID,
}: {
  /** The time left, in milliseconds. */
  remainingMs: number;
  /** Whether the clock runs, so the bar empties on its own until the time is up. */
  running: boolean;
  /** The whole time, in milliseconds, which the bar's length stands for. */
  totalMs: number;
  /** The Edition's texts. */
  texts: {
    /** The time left as VoiceOver reads it, such as «лишилось 40 секунд». */
    remaining: (seconds: number) => string;
    /** The time left as the timer shows it, such as «40 с». */
    shown: (seconds: number) => string;
  };
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const seconds = secondsLeft(remainingMs);
  const announced = useRef(Math.ceil(seconds / ANNOUNCE_EVERY));
  const { remaining, shown } = texts;

  useEffect(() => {
    // The tens still to pass; a fall in them is ten seconds passed.
    const tens = Math.ceil(seconds / ANNOUNCE_EVERY);
    if (tens < announced.current && seconds > 0) {
      AccessibilityInfo.announceForAccessibility(remaining(seconds));
    }
    announced.current = tens;
  }, [seconds, remaining]);

  const left = Math.min(Math.max(remainingMs, 0), totalMs);
  const share = totalMs > 0 ? left / totalMs : 0;
  const reduceMotion = useReduceMotion();
  /** The share of the whole time the bar stands for, 1 full and 0 empty. */
  const filled = useSharedValue(share);
  useEffect(() => {
    // From where the bar is now to empty, in the time left: the whole time's pace.
    filled.value =
      running && !reduceMotion && left > 0
        ? withTiming(0, { duration: left, easing: Easing.linear })
        : share;
  }, [filled, running, reduceMotion, left, share]);
  const leftStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: filled.value }] }));
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={remaining(seconds)}
      {...voice}
      style={styles.timer}
    >
      <View style={[styles.bar, { backgroundColor: colors.silhouette }]}>
        <Animated.View
          testID={`${testID}-left`}
          style={[styles.left, { backgroundColor: colors.accent }, leftStyle]}
        />
      </View>
      <Text
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[typeStyle('timerSeconds', tokens), styles.seconds, { color: colors.ink }]}
      >
        {shown(seconds)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timer: { flexDirection: 'row', alignItems: 'center', gap: roundLayout.gap },
  seconds: {
    width: gameTimerLayout.secondsWidth,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  bar: {
    flex: 1,
    height: gameTimerLayout.barHeight,
    transform: [{ skewX: roundProgress.skew }],
  },
  left: { height: '100%', transformOrigin: 'left' },
});
