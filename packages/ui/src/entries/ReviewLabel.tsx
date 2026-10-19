import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { badgePadding, overlineType } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * The outlined accent label on a card the Feed brought back for Review, such
 * as "Повторення", drawn in capitals at the top of the card. VoiceOver reads
 * the label as written.
 */
export function ReviewLabel() {
  const { colors, fontFamilies, radii } = useTokens();
  const { strings, voice } = useEdition();
  const label = strings.knowledge.review;
  return (
    <View
      testID="review-label"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={[styles.label, { borderColor: colors.accent, borderRadius: radii.chip }]}
    >
      <Text style={[styles.text, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: badgePadding.horizontal,
    paddingVertical: badgePadding.vertical,
  },
  text: overlineType,
});
