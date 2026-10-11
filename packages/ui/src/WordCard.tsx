import type { ReactNode } from 'react';
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
  /** Decor drawn over the card's edges, such as corner ornaments (Decor slot 3). */
  frame?: ReactNode;
  /** Decor between the Lemma and the Definition, such as an ornament divider (Decor slot 2). */
  divider?: ReactNode;
}

/**
 * The Word card: a surface card with the Lemma, part of speech and primary
 * Definition, drawn at the user's font size.
 */
export function WordCard({
  lemma,
  partOfSpeech,
  primaryDefinition,
  frame,
  divider,
}: WordCardProps) {
  const { colors, fontFamilies, radii } = useTokens();
  const { lemma: lemmaSize, definition: definitionSize } = useWordTextSizes();
  return (
    <View
      testID="word-card"
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      <Text
        testID="word-lemma"
        // A long Lemma shrinks to fit rather than break inside a word.
        numberOfLines={lemma.includes(' ') ? 2 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[
          styles.lemma,
          lemmaSize,
          { letterSpacing: lemmaSize.fontSize * -0.01 },
          { color: colors.ink, fontFamily: fontFamilies.word },
        ]}
      >
        {lemma}
      </Text>
      <Text
        testID="word-part-of-speech"
        style={[styles.partOfSpeech, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {partOfSpeech}
      </Text>
      {divider === undefined ? null : <View style={styles.divider}>{divider}</View>}
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
      {frame === undefined ? null : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {frame}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Padding 32 / 26 / 26 from the design; the border is the card's only elevation.
  card: {
    borderWidth: 1,
    paddingTop: space[8],
    paddingHorizontal: 26,
    paddingBottom: 26,
  },
  lemma: { fontWeight: '500' },
  partOfSpeech: { fontSize: typeSize.partOfSpeech, fontWeight: '500' },
  divider: { marginTop: space[5] },
  definition: { marginTop: space[5] },
});
