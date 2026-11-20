import type { CalendarDay } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { freezeCard, typeStyle } from '../tokens';
import { Frost } from './Frost';
import { dayLabel } from './day-label';

/**
 * One day of the strip, a square: an Active Day red, a frozen day cream under
 * the calendar's frost. Today is no different from any other day: red once
 * active, a plain tile until then.
 */
function Day({ day }: { day: CalendarDay }) {
  const tokens = useTokens();
  const { colors } = tokens;
  // Red and cream look the same in both Themes, so their number is the light Theme's ink.
  const key = useSchemeColors('light');
  const { strings, voice } = useEdition();
  const active = { face: colors.accent, number: key.ink };
  const plain = { face: colors.tile, number: colors.muted };
  const look = {
    active,
    today: day.state === 'today' && day.active ? active : { ...plain, number: colors.ink },
    missed: plain,
    frozen: { face: key.background, number: key.ink },
    break: { face: colors.surfaceSunken, number: colors.muted },
    future: plain,
  }[day.state];
  return (
    <View
      testID={`profile-freeze-card-${day.date}`}
      accessible
      accessibilityLabel={dayLabel(strings, day)}
      {...voice}
      style={[styles.day, { backgroundColor: look.face }]}
    >
      {day.state === 'frozen' && <Frost />}
      <Text style={[typeStyle('freezeDay', tokens), { color: look.number }]}>{day.day}</Text>
    </View>
  );
}

/**
 * The Profile's Streak freeze card (p2): an ink card titled
 * «Заморозка серії» with a cream chip of the freezes `held`, what a freeze
 * does and the 7 `days` ending today; under it two tiles, each a big number
 * over its caption declined by it: the Streak in red, and the days the
 * freezes `saved` in it.
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
  // The chip is cream in both Themes (owner's decision 7), so its text is the light Theme's ink.
  const key = useSchemeColors('light');
  const { strings, voice, count } = useEdition();
  const words = strings.settings.profile.freezeCard;
  const tile = (name: string, number: number, caption: string, color: string) => (
    <View
      key={name}
      accessible
      accessibilityLabel={`${String(number)} ${caption}`}
      {...voice}
      style={[styles.tile, { backgroundColor: colors.surfaceSunken }]}
    >
      <Text maxFontSizeMultiplier={1.4} style={[typeStyle('freezeNumber', tokens), { color }]}>
        {String(number)}
      </Text>
      <Text style={[typeStyle('freezeCaption', tokens), { color: colors.muted }]}>{caption}</Text>
    </View>
  );
  return (
    <View testID={testID} style={styles.block}>
      <View style={[styles.card, { backgroundColor: colors.ink }]}>
        <View style={styles.head}>
          <Text
            accessibilityRole="header"
            {...voice}
            style={[typeStyle('freezeTitle', tokens), styles.title, { color: colors.background }]}
          >
            {words.title}
          </Text>
          <View style={[styles.chip, { backgroundColor: key.background }]}>
            <Text {...voice} style={[typeStyle('freezeChip', tokens), { color: key.ink }]}>
              {fill(words.held, { count: String(held) })}
            </Text>
          </View>
        </View>
        <Text
          {...voice}
          style={[typeStyle('freezeText', tokens), styles.text, { color: colors.background }]}
        >
          {words.explanation}
        </Text>
        <View style={styles.strip}>
          {days.map((day) => (
            <Day key={day.date} day={day} />
          ))}
        </View>
      </View>
      <View style={styles.tiles}>
        {tile('streak', streak, count(words.streakDays, streak), colors.accent)}
        {tile('saved', saved, count(words.saved, saved), colors.ink)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: freezeCard.gap },
  card: {
    gap: freezeCard.gap,
    padding: freezeCard.padding,
    borderRadius: freezeCard.radius,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: freezeCard.tiles.gap },
  title: { flex: 1 },
  chip: {
    height: freezeCard.chip.height,
    paddingHorizontal: freezeCard.chip.paddingX,
    borderRadius: freezeCard.chip.radius,
    justifyContent: 'center',
  },
  text: { opacity: freezeCard.textOpacity },
  strip: { flexDirection: 'row', gap: freezeCard.strip.gap },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: freezeCard.day.radius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: { flexDirection: 'row', gap: freezeCard.tiles.gap },
  tile: {
    flex: 1,
    gap: freezeCard.tiles.inside,
    padding: freezeCard.tiles.padding,
    borderRadius: freezeCard.tiles.radius,
  },
});
