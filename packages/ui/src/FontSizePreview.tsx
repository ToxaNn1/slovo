import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from './EditionProvider';
import { OrnamentDivider } from './DecorSlots';
import { useLemmaSize, useWordTextSizes } from './FontSizeProvider';
import { space } from './tokens';
import { useTokens } from './TokensProvider';

/**
 * A Word card in small, drawn at the user's font size and in the Theme in
 * effect, so a size can be judged before leaving Settings.
 */
export function FontSizePreview({
  lemma,
  definition,
  testID,
}: {
  /** The sample Lemma, Stress marks included. */
  lemma: string;
  definition: string;
  testID?: string;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const lemmaSize = useLemmaSize();
  const { definition: definitionSize } = useWordTextSizes();
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${lemma}. ${definition}`}
      {...voice}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      <Text
        testID="font-size-preview-lemma"
        style={[styles.lemma, lemmaSize, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {lemma}
      </Text>
      <OrnamentDivider />
      <Text
        testID="font-size-preview-definition"
        style={[definitionSize, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {definition}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[5],
    borderWidth: StyleSheet.hairlineWidth,
  },
  lemma: { fontWeight: '500' },
});
