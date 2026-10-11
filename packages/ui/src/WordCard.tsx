import { StyleSheet, Text, View } from 'react-native';

import { fontSizeSteps, space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

export interface WordCardProps {
  /** The Lemma as the Core renders it, Stress marks included. */
  lemma: string;
  /** The part of speech in the Edition's language. */
  partOfSpeech: string;
  primaryDefinition: string;
}

const { lemma: lemmaSize, definition: definitionSize } = fontSizeSteps.M;

/** The placeholder Word card: Lemma, part of speech and primary Definition. */
export function WordCard({ lemma, partOfSpeech, primaryDefinition }: WordCardProps) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View style={styles.card}>
      <Text
        testID="word-lemma"
        style={[styles.lemma, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {lemma}
      </Text>
      <Text
        testID="word-part-of-speech"
        style={[styles.partOfSpeech, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {partOfSpeech}
      </Text>
      <Text
        testID="word-definition"
        style={[styles.definition, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {primaryDefinition}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2], paddingHorizontal: space[6] },
  // Room above the glyphs so the Stress mark over a capital or tall vowel isn't clipped.
  lemma: { fontSize: lemmaSize, lineHeight: lemmaSize * 1.3, fontWeight: '500' },
  partOfSpeech: { fontSize: typeSize.partOfSpeech, fontWeight: '500' },
  definition: {
    fontSize: definitionSize,
    lineHeight: definitionSize * 1.5,
    marginTop: space[3],
  },
});
