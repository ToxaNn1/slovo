'use no memo';
import type { CalendarDay, CalendarMonth } from '@slovo/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { calendarDay, space, typeSize } from '../tokens';

/** How far, in points, a finger moves sideways before the swipe takes over from the sheet's scroll. */
const SWIPE_START = 15;
/** How far, in points, a swipe goes to turn the month. */
const SWIPE_DISTANCE = 50;

/**
 * One day of the grid: its number, today's ring, and the dot of an Active Day,
 * in the success colour (the accent reads as an error in an Edition whose
 * accent is red), or the quiet grey of a missed one.
 */
function Day({ day, month }: { day: CalendarDay; month: number }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const words = strings.stats.calendar;
  const today = day.state === 'today';
  const active = day.state === 'active' || (today && day.active);
  const spoken = today ? (active ? 'todayActive' : 'today') : day.state;
  const dot = active ? colors.correct : day.state === 'missed' ? colors.track : 'transparent';
  return (
    <View
      testID={`stats-calendar-${day.date}`}
      accessible
      accessibilityLabel={fill(words.days[spoken], {
        day: String(day.day),
        month: words.dayMonths[month - 1] ?? '',
      })}
      {...voice}
      style={styles.cell}
    >
      <View style={[styles.ring, today && { borderColor: colors.ink }]}>
        <Text
          style={[
            styles.number,
            {
              color: day.state === 'future' || day.state === 'missed' ? colors.muted : colors.ink,
              fontFamily: fontFamilies.ui,
            },
          ]}
        >
          {day.day}
        </Text>
      </View>
      <View
        testID={`stats-calendar-${day.date}-dot`}
        style={[styles.dot, { backgroundColor: dot }]}
      />
    </View>
  );
}

/**
 * The Active Days calendar of the stats sheet: a month grid, Monday first,
 * with a filled dot on each Active Day, a quiet grey one on each day missed,
 * never red, and today outlined. It opens on the current month; a swipe to the
 * right goes back a month, to the left forward, from the first month to the
 * current one and no further, and VoiceOver turns it with a swipe up or down on
 * the month's name. Each day reads its date and whether it is an Active Day.
 * With no months, as with its Feature Switch off, it draws nothing.
 */
export function ActiveDaysCalendar({ months }: { months: readonly CalendarMonth[] }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  // How many months back from the current one the reader has turned.
  const [back, setBack] = useState(0);
  const last = months.length - 1;
  const within = (count: number) => Math.min(Math.max(count, 0), last);
  const shown = months[last - within(back)];
  if (shown === undefined) return null;
  const words = strings.stats.calendar;
  const turn = (forward: boolean) => {
    setBack((current) => within(within(current) + (forward ? -1 : 1)));
  };
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-SWIPE_START, SWIPE_START])
    .failOffsetY([-SWIPE_START, SWIPE_START])
    .onEnd(({ translationX }) => {
      if (Math.abs(translationX) >= SWIPE_DISTANCE) turn(translationX < 0);
    })
    // How a component test finds the swipe; Gesture Handler reads it in Jest only.
    .withTestId('stats-calendar-swipe');
  const title = fill(words.title, {
    month: words.months[shown.month - 1] ?? '',
    year: String(shown.year),
  });
  return (
    <GestureDetector gesture={swipe}>
      <View testID="stats-calendar" style={styles.calendar}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={words.label}
          accessibilityValue={{ text: title }}
          accessibilityHint={words.hint}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            turn(nativeEvent.actionName === 'increment');
          }}
          {...voice}
        >
          <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
            {title}
          </Text>
        </View>
        {/* Each day reads its own date, so VoiceOver skips the weekday names. */}
        <View
          style={styles.week}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {words.weekdays.map((weekday) => (
            <Text
              key={weekday}
              style={[styles.weekday, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {weekday}
            </Text>
          ))}
        </View>
        {shown.weeks.map((week, row) => (
          <View key={row} style={styles.week}>
            {week.map((day, slot) =>
              day === undefined ? (
                <View key={slot} style={styles.cell} />
              ) : (
                <Day key={day.date} day={day} month={shown.month} />
              ),
            )}
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  calendar: { marginTop: space[6], gap: space[2] },
  title: { fontSize: typeSize.blockHeading, fontWeight: '600', marginBottom: space[1] },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: typeSize.meta },
  cell: { flex: 1, alignItems: 'center', gap: calendarDay.dotGap },
  ring: {
    width: calendarDay.ring,
    height: calendarDay.ring,
    borderRadius: calendarDay.ring / 2,
    borderWidth: calendarDay.ringBorder,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontSize: typeSize.caption },
  dot: { width: calendarDay.dot, height: calendarDay.dot, borderRadius: calendarDay.dot / 2 },
});
