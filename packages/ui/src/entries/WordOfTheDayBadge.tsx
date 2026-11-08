import type { LocalDate } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { fill, useEdition } from '../providers/EditionProvider';
import { badgePadding, entryCardFrame, space, typeStyle, wedges } from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useOnAccent } from './on-accent';

/**
 * The filled accent badge that marks the Word of the Day, such as
 * "Слово дня · 11 жовтня", drawn in capitals over the Lemma. VoiceOver reads
 * the label as written. On the red ground it is the bare kicker in the key
 * ink, with no fill.
 */
export function WordOfTheDayBadge({ day: { month, day } }: { day: LocalDate }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { strings, voice } = useEdition();
  const keyInk = useSchemeColors('light').ink;
  const onAccent = useOnAccent();
  const label = fill(strings.wordOfTheDay.badge, {
    day: String(day),
    month: strings.dates.months[month - 1] ?? '',
  });
  return (
    <View
      testID="word-of-the-day-badge"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={
        onAccent
          ? styles.kicker
          : [styles.badge, { backgroundColor: colors.accent, borderRadius: radii.chip }]
      }
    >
      <Text
        style={
          onAccent
            ? [typeStyle('heroKicker', tokens), { color: keyInk }]
            : [typeStyle('eyebrow', tokens), { color: colors.background }]
        }
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * The kicker that marks the Word of the Day on its tabbed card (ADR 0088,
 * board p1): a red wedge and «СЛОВО ДНЯ · 7.11» in red capitals, no fill.
 * VoiceOver reads the label as written.
 */
export function WordOfTheDayKicker({ day: { month, day } }: { day: LocalDate }) {
  const tokens = useTokens();
  const { strings, voice } = useEdition();
  const label = fill(strings.wordOfTheDay.kicker, { day: String(day), month: String(month) });
  const { wedge } = entryCardFrame.kicker;
  return (
    <View
      testID="word-of-the-day-kicker"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={styles.kickerRow}
    >
      <Wedge
        points={wedges.logo}
        color={tokens.colors.accent}
        width={wedge.width}
        height={wedge.height}
      />
      <Text
        numberOfLines={1}
        style={[typeStyle('heroKicker', tokens), { color: tokens.colors.accent }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: entryCardFrame.kicker.gap,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: badgePadding.horizontal,
    paddingVertical: badgePadding.vertical,
    marginBottom: space[3],
  },
  kicker: { alignSelf: 'flex-start' },
});
