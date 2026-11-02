import type { LocalDate } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { badgePadding, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * The filled accent badge that marks the Word of the Day, such as
 * "Слово дня · 11 жовтня", drawn in capitals over the Lemma. VoiceOver reads
 * the label as written.
 */
export function WordOfTheDayBadge({ day: { month, day } }: { day: LocalDate }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { strings, voice } = useEdition();
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
      style={[styles.badge, { backgroundColor: colors.accent, borderRadius: radii.chip }]}
    >
      <Text style={[typeStyle('eyebrow', tokens), { color: colors.background }]}>
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
});
