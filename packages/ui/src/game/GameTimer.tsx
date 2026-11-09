import { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { gameTimerLayout, roundLayout, roundProgress, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the seconds, so the header keeps its shape. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** VoiceOver reads the time left each time this many seconds pass. */
const ANNOUNCE_EVERY = 10;

/** The whole seconds left, counted up, so the timer reads 0 only once the time is up. */
const secondsLeft = (remainingMs: number) => Math.max(0, Math.ceil(remainingMs / 1000));

/**
 * A timed Game's countdown in its own row under the Round's header: a bar of
 * ten skewed segments that empty from the accent as the time runs out (board
 * 06, spec #1674), then the seconds left, such as «40 с», drawn from the time
 * left the Core gives. VoiceOver
 * reads the time left each time ten seconds pass, once even when the time
 * jumps over a ten, and never at none. The screen ticks the time and pauses
 * it, and passes the Edition's texts.
 */
export function GameTimer({
  remainingMs,
  totalMs,
  texts,
  testID,
}: {
  /** The time left, in milliseconds. */
  remainingMs: number;
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
  // A segment stays lit while any of its share of the time is left, so the bar empties only at none.
  const lit = totalMs > 0 ? Math.ceil((left * roundProgress.segments) / totalMs) : 0;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={remaining(seconds)}
      {...voice}
      style={styles.timer}
    >
      <View style={styles.bar}>
        {Array.from({ length: roundProgress.segments }, (_, place) => (
          <View
            key={place}
            style={[
              styles.segment,
              { backgroundColor: place < lit ? colors.accent : colors.silhouette },
            ]}
          />
        ))}
      </View>
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
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
  bar: { flex: 1, flexDirection: 'row', gap: roundProgress.gap },
  segment: {
    flex: 1,
    height: gameTimerLayout.barHeight,
    transform: [{ skewX: roundProgress.skew }],
  },
});
