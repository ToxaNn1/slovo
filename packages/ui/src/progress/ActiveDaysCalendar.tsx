'use no memo';
import type { CalendarDay, CalendarWeek } from '@slovo/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { calendarDay, space, typeStyle } from '../tokens';
import { dayDate, dayLabel } from './day-label';

/**
 * One day of the grid as a tile over its edge: an Active Day red, today in
 * ink over a red edge, a missed day plain, a frozen day cream under frost, a
 * Break day sunken, pressed into its place with the edge inside its top, and
 * a day to come no tile, only a dashed outline (board 10). With `onPress` it
 * is a button whose tile presses down onto its edge. The Break card's strip
 * draws its days with it too.
 */
export function CalendarDayTile({
  day,
  onPress,
}: {
  day: CalendarDay;
  onPress: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  // The number on red is the ink of the light Theme in both Themes, as on every red face.
  const key = useSchemeColors('light');
  const keyInk = key.ink;
  const { strings, voice } = useEdition();
  const look = {
    active: { face: colors.accent, edge: colors.accentEdge, number: keyInk },
    today: { face: colors.ink, edge: colors.accent, number: colors.background },
    missed: { face: colors.tile, edge: colors.tileEdge, number: colors.muted },
    // Cream is the same in both Themes, so its number is the light Theme's ink.
    frozen: { face: key.background, edge: colors.tileEdge, number: keyInk },
    // Pressed in: no edge under it, the edge drawn inside its top instead.
    break: { face: colors.surfaceSunken, edge: undefined, number: colors.ink },
    future: { face: 'transparent', edge: undefined, number: colors.muted },
  }[day.state];
  const tile = (pressed: boolean) => (
    <>
      {look.edge !== undefined && (
        <View style={[styles.tile, styles.edge, { backgroundColor: look.edge }]} />
      )}
      <View
        testID={`stats-calendar-${day.date}-face`}
        style={[
          styles.tile,
          { backgroundColor: look.face },
          day.state === 'future' && [styles.future, { borderColor: colors.line }],
          day.state === 'break' && [
            styles.pressed,
            styles.sunken,
            { borderTopColor: colors.tileEdge },
          ],
          pressed && styles.pressed,
        ]}
      >
        {day.state === 'frozen' && <Frost />}
        <Text style={[typeStyle('calendarDay', tokens), { color: look.number }]}>{day.day}</Text>
      </View>
    </>
  );
  const shared = {
    testID: `stats-calendar-${day.date}`,
    accessible: true,
    accessibilityLabel: dayLabel(strings, day),
    ...voice,
    style: styles.cell,
  };
  return onPress === undefined ? (
    <View {...shared}>{tile(false)}</View>
  ) : (
    <Pressable {...shared} accessibilityRole="button" onPress={onPress}>
      {({ pressed }) => tile(pressed)}
    </Pressable>
  );
}

/** The frost over a frozen day: diagonal stripes across the tile, as board 10 draws it. */
function Frost() {
  const count = Math.ceil((calendarDay.height * 3) / calendarDay.frost.step);
  return (
    <View style={styles.frost} pointerEvents="none">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.stripe, { left: index * calendarDay.frost.step - calendarDay.height }]}
        />
      ))}
    </View>
  );
}

/**
 * The Active Days calendar: the 35 days ending with the current week, five
 * rows Monday first under the weekday names, across months (ADR 0085). Each
 * day reads its date and state. With `lines` on, a tap on a day shows its line
 * under the grid: an Active Day, today once active with the Word `todayWord`
 * opened, a day missed, a day to come; a Break day, a frozen day and today
 * without its Word have none. With no weeks, as with its Feature Switch off,
 * it draws nothing.
 */
export function ActiveDaysCalendar({
  weeks,
  lines = false,
  todayWord,
}: {
  weeks: readonly CalendarWeek[];
  /** Whether a tap on a day shows its line: the `calendarDayLines` Feature Switch. */
  lines?: boolean;
  /** The Lemma of today's Word of the Day, once the reader opened it. */
  todayWord?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  if (weeks.length === 0) return null;
  const words = strings.stats.calendar;

  /** The line a tap on the day shows, if it has one. */
  function lineOf(day: CalendarDay): string | undefined {
    const date = dayDate(strings, day);
    switch (day.state) {
      case 'active':
        return fill(words.lines.active, date);
      case 'missed':
        return fill(words.lines.missed, date);
      case 'future':
        return words.lines.future;
      case 'today':
        return day.active && todayWord !== undefined
          ? fill(words.lines.today, { word: todayWord })
          : undefined;
      case 'break':
      case 'frozen':
        return undefined;
    }
  }
  const pickedDay = weeks.flat().find(({ date }) => date === picked);
  const line = lines && pickedDay !== undefined ? lineOf(pickedDay) : undefined;

  return (
    <View testID="stats-calendar" accessibilityLabel={words.label} style={styles.calendar}>
      {/* Each day reads its own date, so VoiceOver skips the weekday names. */}
      <View
        style={styles.week}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {words.weekdays.map((weekday) => (
          <Text
            key={weekday}
            style={[typeStyle('calendarWeekday', tokens), styles.weekday, { color: colors.muted }]}
          >
            {weekday}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]?.date} style={styles.week}>
          {week.map((day) => (
            <CalendarDayTile
              key={day.date}
              day={day}
              onPress={
                lines
                  ? () => {
                      setPicked(day.date);
                    }
                  : undefined
              }
            />
          ))}
        </View>
      ))}
      {line !== undefined && (
        <Text
          testID="stats-calendar-line"
          accessibilityLiveRegion="polite"
          {...voice}
          style={[typeStyle('profileText', tokens), styles.line, { color: colors.ink }]}
        >
          {line}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { marginTop: space[6], gap: space[2] },
  week: { flexDirection: 'row', gap: calendarDay.gap },
  weekday: {
    flex: 1,
    textAlign: 'center',
  },
  cell: { flex: 1, height: calendarDay.height + calendarDay.edge },
  tile: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: calendarDay.height,
    borderRadius: calendarDay.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edge: { top: calendarDay.edge },
  pressed: { top: calendarDay.edge },
  sunken: { borderTopWidth: calendarDay.edge, overflow: 'hidden' },
  frost: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderRadius: calendarDay.radius },
  stripe: {
    position: 'absolute',
    top: -calendarDay.height,
    width: calendarDay.frost.stripe,
    height: calendarDay.height * 3,
    backgroundColor: calendarDay.frost.color,
    transform: [{ rotate: '45deg' }],
  },
  future: { borderWidth: calendarDay.futureBorder, borderStyle: 'dashed' },
  line: { marginTop: space[1] },
});
