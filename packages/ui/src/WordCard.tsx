import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { colors, fontSize, space } from './tokens';

export interface WordCardProps {
  /** The Lemma as the Core renders it, Stress marks included. */
  lemma: string;
  /** The part of speech in the Edition's language. */
  partOfSpeech: string;
  primaryDefinition: string;
}

/** The placeholder Word card: Lemma, part of speech and primary Definition. */
export function WordCard({ lemma, partOfSpeech, primaryDefinition }: WordCardProps) {
  const palette = colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  return (
    <View style={styles.card}>
      <Text testID="word-lemma" style={[styles.lemma, { color: palette.text }]}>
        {lemma}
      </Text>
      <Text testID="word-part-of-speech" style={[styles.partOfSpeech, { color: palette.muted }]}>
        {partOfSpeech}
      </Text>
      <Text testID="word-definition" style={[styles.definition, { color: palette.text }]}>
        {primaryDefinition}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s, paddingHorizontal: space.l },
  // Room above the glyphs so the Stress mark over a capital or tall vowel isn't clipped.
  lemma: { fontSize: fontSize.lemma, lineHeight: fontSize.lemma * 1.35, fontWeight: '600' },
  partOfSpeech: { fontSize: fontSize.caption, fontStyle: 'italic' },
  definition: { fontSize: fontSize.body, lineHeight: fontSize.body * 1.4, marginTop: space.s },
});
