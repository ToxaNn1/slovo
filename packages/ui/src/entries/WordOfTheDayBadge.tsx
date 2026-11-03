import type { LocalDate } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { badgePadding, space, typeStyle } from '../tokens';
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

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: badgePadding.horizontal,
    paddingVertical: badgePadding.vertical,
    marginBottom: space[3],
  },
  kicker: { alignSelf: 'flex-start' },
});
