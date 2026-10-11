import { StyleSheet, Text, View } from 'react-native';

import { useWordTextSizes } from './FontSizeProvider';
import { space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

export interface WordCardProps {
  /** The Lemma as the Core renders it, Stress marks included. */
  lemma: string;
  /** The part of speech in the Edition's language. */
  partOfSpeech: string;
  primaryDefinition: string;
}

/** The placeholder Word card: Lemma, part of speech and primary Definition. */
export function WordCard({ lemma, partOfSpeech, primaryDefinition }: WordCardProps) {
  const { colors, fontFamilies } = useTokens();
  const { lemma: lemmaSize, definition: definitionSize } = useWordTextSizes();
  return (
    <View style={styles.card}>
      <Text
        testID="word-lemma"
        style={[styles.lemma, lemmaSize, { color: colors.ink, fontFamily: fontFamilies.word }]}
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
        style={[
          styles.definition,
          definitionSize,
          { color: colors.ink, fontFamily: fontFamilies.word },
        ]}
      >
        {primaryDefinition}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2], paddingHorizontal: space[6] },
  lemma: { fontWeight: '500' },
  partOfSpeech: { fontSize: typeSize.partOfSpeech, fontWeight: '500' },
  definition: { marginTop: space[3] },
});
