import type { CalendarDay } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { calendarDay, freezeCard, space, typeStyle } from '../tokens';
import { dayLabel } from './day-label';

const { frost } = freezeCard;

/** The frost on a frozen day: three strokes crossing, as a snowflake. */
function Frost({ color }: { color: string }) {
  const half = frost.box / 2;
  return (
    <Svg width={frost.box} height={frost.box} style={styles.frost}>
      {[0, 60, 120].map((angle) => {
        const turn = (angle * Math.PI) / 180;
        const dx = Math.sin(turn) * half;
        const dy = Math.cos(turn) * half;
        return (
          <Line
            key={angle}
            x1={half - dx}
            y1={half - dy}
            x2={half + dx}
            y2={half + dy}
            stroke={color}
            strokeWidth={frost.stroke}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

/** One day of the strip: an Active Day red, a frozen day cream with frost, today outlined in red. */
function Day({ day }: { day: CalendarDay }) {
  const tokens = useTokens();
  const { colors } = tokens;
  // The number on red is the ink of the light Theme in both Themes, as on every red face.
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const look = {
    active: { face: colors.accent, number: keyInk },
    today: {
      face: day.state === 'today' && day.active ? colors.accent : colors.background,
      number: day.state === 'today' && day.active ? keyInk : colors.ink,
    },
    missed: { face: colors.tile, number: colors.muted },
    frozen: { face: colors.highlight, number: colors.ink },
    break: { face: colors.surfaceSunken, number: colors.muted },
    future: { face: colors.tile, number: colors.muted },
  }[day.state];
  return (
    <View
      testID={`profile-freeze-card-${day.date}`}
      accessible
      accessibilityLabel={dayLabel(strings, day)}
      {...voice}
      style={[
        styles.day,
        { backgroundColor: look.face },
        day.state === 'today' && [styles.today, { borderColor: colors.accent }],
      ]}
    >
      <Text style={[typeStyle('calendarDay', tokens), { color: look.number }]}>{day.day}</Text>
      {day.state === 'frozen' && <Frost color={colors.ink} />}
    </View>
  );
}

/**
 * The Profile's Streak freeze card (p2, ADR 0085): an ink card titled
 * «Заморозка серії» with a red chip of the freezes `held`, what a freeze
 * does, the 7 `days` ending today, a frozen one cream with frost, and two
 * tiles, the Streak and the days the freezes `saved` in it.
 */
export function StreakFreezeCard({
  held,
  streak,
  saved,
  days,
  testID,
}: {
  held: number;
  streak: number;
  saved: number;
  days: readonly CalendarDay[];
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice, count } = useEdition();
  const words = strings.settings.profile.freezeCard;
  const tile = (key: string, text: string) => (
    <View key={key} style={[styles.tile, { backgroundColor: colors.background }]}>
      <Text {...voice} style={[typeStyle('rowLabel', tokens), { color: colors.ink }]}>
        {text}
      </Text>
    </View>
  );
  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.ink }]}>
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          {...voice}
          style={[typeStyle('heading', tokens), styles.title, { color: colors.background }]}
        >
          {words.title}
        </Text>
        <View style={[styles.chip, { backgroundColor: colors.accent }]}>
          <Text {...voice} style={[typeStyle('labelChip', tokens), { color: keyInk }]}>
            {fill(words.held, { count: String(held) })}
          </Text>
        </View>
      </View>
      <Text {...voice} style={[typeStyle('profileText', tokens), { color: colors.background }]}>
        {words.explanation}
      </Text>
      <View style={styles.strip}>
        {days.map((day) => (
          <Day key={day.date} day={day} />
        ))}
      </View>
      <View style={styles.tiles}>
        {tile('streak', count(words.streakDays, streak))}
        {tile('saved', count(words.saved, saved))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: freezeCard.gap,
    padding: freezeCard.padding,
    borderRadius: freezeCard.radius,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flex: 1 },
  chip: {
    paddingHorizontal: freezeCard.chip.paddingX,
    paddingVertical: freezeCard.chip.paddingY,
    borderRadius: freezeCard.chip.radius,
  },
  strip: { flexDirection: 'row', gap: calendarDay.gap },
  day: {
    flex: 1,
    height: calendarDay.height,
    borderRadius: calendarDay.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: calendarDay.futureBorder },
  frost: { position: 'absolute', top: space[1], right: space[1] },
  tiles: { flexDirection: 'row', gap: freezeCard.tilesGap },
  tile: { flex: 1, padding: freezeCard.tilePadding, borderRadius: freezeCard.tileRadius },
});
