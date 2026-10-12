import type { LocalDate } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from './EditionProvider';
import { overlineType, space } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * The filled accent badge that marks the Word of the Day, such as
 * "Слово дня · 11 жовтня", drawn in capitals over the Lemma. VoiceOver reads
 * the label as written.
 */
export function WordOfTheDayBadge({ day: { month, day } }: { day: LocalDate }) {
  const { colors, fontFamilies, radii } = useTokens();
  const { strings, voice } = useEdition();
  const { badge, months } = strings.wordOfTheDay;
  const label = fill(badge, { day: String(day), month: months[month - 1] ?? '' });
  return (
    <View
      testID="word-of-the-day-badge"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={[styles.badge, { backgroundColor: colors.accent, borderRadius: radii.chip }]}
    >
      <Text style={[styles.label, { color: colors.background, fontFamily: fontFamilies.ui }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: space[3],
  },
  label: overlineType,
});
