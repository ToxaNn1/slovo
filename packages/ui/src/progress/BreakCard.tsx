import type { CalendarDay } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { breakCard, typeStyle } from '../tokens';
import { CalendarDayTile } from './ActiveDaysCalendar';

/**
 * The Profile's Break card while a Break runs (p1, board 10): the paused
 * Streak as a ghost number in the corner, two slanted bars before the
 * kicker, the paused line and the Break's last day; under it the strip of its
 * 14 days, and the date the next Break can start. Every text comes in
 * filled by the screen.
 */
export function BreakCard({
  testID,
  streak,
  kicker,
  paused,
  until,
  strip,
  next,
}: {
  testID?: string;
  /** The paused Streak, drawn as the ghost number. */
  streak: number;
  kicker: string;
  paused: string;
  until: string;
  /** The 14 days of the strip, the Break's among them. */
  strip: readonly CalendarDay[];
  next: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const weeks = Array.from({ length: Math.ceil(strip.length / 7) }, (_, week) =>
    strip.slice(week * 7, week * 7 + 7),
  );
  return (
    <View testID={testID} style={styles.block}>
      <View style={[styles.card, { backgroundColor: colors.surfaceSunken }]}>
        <Text
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          maxFontSizeMultiplier={1}
          style={[typeStyle('breakGhost', tokens), styles.ghost, { color: colors.muted }]}
        >
          {String(streak)}
        </Text>
        <View style={styles.kicker}>
          <View style={styles.bars}>
            <View style={[styles.bar, { backgroundColor: colors.ink }]} />
            <View style={[styles.bar, { backgroundColor: colors.ink }]} />
          </View>
          <Text
            accessibilityRole="header"
            {...voice}
            style={[typeStyle('breakKicker', tokens), { color: colors.ink }]}
          >
            {kicker}
          </Text>
        </View>
        <Text
          {...voice}
          style={[typeStyle('breakPaused', tokens), styles.paused, { color: colors.ink }]}
        >
          {paused}
        </Text>
        <Text {...voice} style={[typeStyle('breakUntil', tokens), { color: colors.muted }]}>
          {until}
        </Text>
      </View>
      <View style={[styles.strip, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {weeks.map((week, index) => (
          <View key={week[0]?.date ?? index} style={styles.week}>
            {week.map((day) => (
              <CalendarDayTile key={day.date} day={day} onPress={undefined} />
            ))}
          </View>
        ))}
      </View>
      <Text
        {...voice}
        style={[typeStyle('breakNext', tokens), styles.next, { color: colors.muted }]}
      >
        {next}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: breakCard.gap },
  card: {
    borderRadius: breakCard.radius,
    paddingVertical: breakCard.padding.vertical,
    paddingHorizontal: breakCard.padding.horizontal,
    overflow: 'hidden',
    gap: breakCard.gap,
  },
  ghost: {
    position: 'absolute',
    right: breakCard.ghost.right,
    top: breakCard.ghost.top,
    opacity: breakCard.ghost.opacity,
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: breakCard.kickerGap },
  bars: { flexDirection: 'row', gap: breakCard.bar.gap },
  bar: {
    width: breakCard.bar.width,
    height: breakCard.bar.height,
    transform: [{ skewX: breakCard.bar.skew }],
  },
  paused: { maxWidth: breakCard.pausedWidth },
  strip: {
    borderRadius: breakCard.strip.radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: breakCard.strip.padding,
    gap: breakCard.strip.gap,
  },
  week: { flexDirection: 'row', gap: breakCard.strip.gap },
  next: { paddingHorizontal: breakCard.nextInset },
});
