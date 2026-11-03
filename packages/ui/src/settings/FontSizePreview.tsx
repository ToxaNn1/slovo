import { StyleSheet, Text, View } from 'react-native';

import { WholeWordsText } from '../primitives/WholeWordsText';
import { useEdition } from '../providers/EditionProvider';
import { useLemmaSize, useWordTextSizes } from '../providers/FontSizeProvider';
import { space, typeRoles, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * A Word card in small, drawn at the user's font size and in the Theme in
 * effect, so a size can be judged before leaving Settings. The Lemma wraps
 * between words and never inside one, smaller when a word is wider than the card.
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
  const tokens = useTokens();
  const { colors, radii } = tokens;
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
      <WholeWordsText
        testID="font-size-preview-lemma"
        text={lemma}
        size={lemmaSize}
        tracking={typeRoles.heroWord.letterSpacing / typeRoles.heroWord.size}
        style={[typeStyle('heroWord', tokens), { color: colors.ink }]}
      />
      <Text
        testID="font-size-preview-definition"
        style={[typeStyle('definition', tokens), definitionSize, { color: colors.ink }]}
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
});
