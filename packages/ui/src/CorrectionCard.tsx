import type { EditionStrings } from '@slovo/contracts';
import type { CorrectionCardModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useWordTextSizes } from './FontSizeProvider';
import { space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';
import { COMPACT_LEMMA, COMPACT_PADDING, COMPACT_WIDTH, fill, withAlpha } from './WordCard';

/** The Edition's Correction card strings. */
export type CorrectionCardStrings = EditionStrings['correctionCard'];

export interface CorrectionCardProps {
  /** What the card shows, as the Core built it. */
  card: CorrectionCardModel;
  strings: CorrectionCardStrings;
  /** The Edition's language (BCP 47), so VoiceOver reads the card in its voice. */
  language?: string;
  /**
   * Decor between the non-standard form and the standard one, such as an
   * ornament divider with an arrow in its centre (Decor slot 2).
   */
  divider?: ReactNode;
}

/**
 * The Correction card: the Correction Type, the non-standard form muted and
 * struck through, the main standard equivalent at the Lemma's size with the
 * others under it, the explanation and the example pair. A Correction carries
 * no Stress, and nothing on the card reads as an error.
 */
export function CorrectionCard({ card, strings, language, divider }: CorrectionCardProps) {
  const { colors, fontFamilies, radii } = useTokens();
  const sizes = useWordTextSizes();
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  const mainSize = compact
    ? {
        fontSize: sizes.lemma.fontSize * COMPACT_LEMMA,
        lineHeight: sizes.lemma.lineHeight * COMPACT_LEMMA,
      }
    : sizes.lemma;
  const padding = compact ? COMPACT_PADDING : 1;
  const voice = language === undefined ? {} : { accessibilityLanguage: language };
  const correctionType = strings.correctionTypes[card.correctionType];
  const sentence = [sizes.example, { fontFamily: fontFamilies.word }];

  return (
    <View
      testID="correction-card"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderRadius: radii.card,
          paddingTop: CARD_TOP * padding,
          paddingHorizontal: CARD_SIDE * padding,
          paddingBottom: CARD_BOTTOM * padding,
          gap: CARD_GAP * padding,
        },
      ]}
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          {...voice}
          style={[styles.overline, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.title}
        </Text>
        <View
          testID="correction-type"
          accessible
          accessibilityLabel={fill(strings.correctionType, { type: correctionType })}
          {...voice}
          style={[
            styles.typeChip,
            { borderColor: withAlpha(colors.accent, 0.45), borderRadius: radii.chip },
          ]}
        >
          <Text style={[styles.typeText, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
            {correctionType}
          </Text>
        </View>
      </View>
      <View
        testID="correction-non-standard"
        accessible
        accessibilityLabel={`${strings.nonStandard}: ${card.nonStandardForm}`}
        {...voice}
        style={styles.form}
      >
        <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
          {strings.nonStandard}
        </Text>
        <Text
          style={[
            styles.nonStandardForm,
            {
              color: colors.muted,
              fontFamily: fontFamilies.word,
              textDecorationColor: withAlpha(colors.accent, 0.55),
            },
          ]}
        >
          {card.nonStandardForm}
        </Text>
      </View>
      {divider === undefined ? null : <View>{divider}</View>}
      <View style={styles.form}>
        <View
          testID="correction-standard"
          accessible
          accessibilityLabel={`${strings.standard}: ${card.mainEquivalent}`}
          {...voice}
          style={styles.form}
        >
          <Text style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
            {strings.standard}
          </Text>
          <Text
            // A phrase wraps; a single word shrinks to fit rather than break.
            numberOfLines={card.mainEquivalent.includes(' ') ? 3 : 1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[
              styles.mainEquivalent,
              mainSize,
              { letterSpacing: mainSize.fontSize * -0.01 },
              { color: colors.ink, fontFamily: fontFamilies.word },
            ]}
          >
            {card.mainEquivalent}
          </Text>
        </View>
        {card.otherEquivalents.length === 0 ? null : (
          <Text
            testID="correction-other-equivalents"
            {...voice}
            style={[styles.body, { color: colors.inkSecondary, fontFamily: fontFamilies.ui }]}
          >
            {fill(strings.otherEquivalents, { equivalents: card.otherEquivalents.join(', ') })}
          </Text>
        )}
      </View>
      <Text
        testID="correction-explanation"
        {...voice}
        style={[styles.explanation, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {card.explanation}
      </Text>
      <View
        testID="correction-example-pair"
        style={[
          styles.examplePair,
          { backgroundColor: colors.surfaceSunken, borderRadius: radii.chip },
        ]}
      >
        <View
          accessible
          accessibilityLabel={fill(strings.exampleNonStandard, {
            text: card.examplePair.nonStandard,
          })}
          {...voice}
          style={styles.exampleRow}
        >
          <Mark lineHeight={sizes.example.lineHeight}>
            <Path d="M7 12h10" stroke={colors.muted} strokeWidth={1.8} />
          </Mark>
          <Text style={[styles.sentence, sentence, { color: colors.muted }]}>
            {card.examplePair.nonStandard}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={fill(strings.exampleStandard, { text: card.examplePair.standard })}
          {...voice}
          style={styles.exampleRow}
        >
          <Mark lineHeight={sizes.example.lineHeight}>
            <Path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke={colors.correct}
              strokeWidth={2.2}
            />
          </Mark>
          <Text style={[styles.sentence, sentence, { color: colors.ink }]}>
            {card.examplePair.standard}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The mark before a sentence of the example pair, centred on its first line. */
function Mark({ lineHeight, children }: { lineHeight: number; children: ReactNode }) {
  return (
    <View style={[styles.mark, { height: lineHeight }]}>
      <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 24 24">
        {children}
      </Svg>
    </View>
  );
}

/** Padding 28 / 26 / 24 from the design; 16 between blocks. */
const CARD_TOP = 28;
const CARD_SIDE = 26;
const CARD_BOTTOM = 24;
const CARD_GAP = 16;
const MARK_SIZE = 18;

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  overline: {
    flexShrink: 1,
    fontSize: typeSize.overline,
    fontWeight: '700',
    letterSpacing: typeSize.overline * 0.14,
    textTransform: 'uppercase',
  },
  typeChip: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  typeText: { fontSize: 11.5, fontWeight: '600' },
  form: { gap: space[2] },
  label: { fontSize: typeSize.body, fontWeight: '500' },
  nonStandardForm: {
    fontSize: 26,
    lineHeight: 26 * 1.2,
    fontWeight: '400',
    textDecorationLine: 'line-through',
  },
  mainEquivalent: { fontWeight: '500' },
  body: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
  explanation: { fontSize: 16, lineHeight: 16 * 1.55 },
  examplePair: { gap: space[3], paddingVertical: space[4], paddingHorizontal: space[4] },
  exampleRow: { flexDirection: 'row', gap: space[3] },
  mark: { width: MARK_SIZE, justifyContent: 'center' },
  sentence: { flex: 1 },
});
