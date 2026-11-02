import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeStyle, wordCardControls } from '../tokens';

/**
 * The chip naming an Entry's Category on its card, filled where the chips of
 * the Correction Type and register are outlined. VoiceOver reads it as the
 * Category, in the Edition's language.
 */
export function CategoryChip({ testID, name }: { testID: string; name: string }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice, strings } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={fill(strings.wordCard.category, { category: name })}
      {...voice}
      style={[styles.chip, { backgroundColor: colors.surfaceSunken, borderRadius: radii.chip }]}
    >
      <Text style={[typeStyle('categoryChip', tokens), { color: colors.ink }]}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: space[3],
    paddingVertical: wordCardControls.chipPaddingVertical,
  },
});
