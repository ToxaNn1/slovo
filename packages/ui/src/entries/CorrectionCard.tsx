import type { CorrectionCardModel } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { OrnamentDivider } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { SectionLabel } from '../primitives/headings';
import { OutlinedChip } from '../primitives/OutlinedChip';
import { correctionCardLayout, space, typeSize, withAlpha } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';

/**
 * The Correction card's blocks inside the Entry card's frame: the Correction
 * Type, the non-standard form muted and struck through, the main standard
 * equivalent at the Lemma's size with the others under it, the explanation,
 * the example pair and, when the Correction has sources, a line naming them. A Correction carries no Stress, and nothing on the card
 * reads as an error. Under Self-check it keeps only the non-standard form and
 * asks how to say it right; the Entry card draws the button that reveals the
 * rest under it.
 */
export function CorrectionCardBody({
  card,
  lemmaSize: mainSize,
  concealed,
}: {
  card: CorrectionCardModel;
  /** The Lemma's size at the user's font size, which the main standard equivalent takes. */
  lemmaSize: TextSize;
  /** Self-check: only the non-standard form and the question. */
  concealed: boolean;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.correctionCard;
  // In the Feed, VoiceOver turns to the next or previous card from the two forms.
  const turnActions = usePageTurnActions();
  const correctionType = strings.correctionTypes[card.correctionType];
  const sentence = [sizes.example, { fontFamily: fontFamilies.word }];

  return (
    <>
      <View style={styles.header}>
        <SectionLabel style={styles.title}>{strings.title}</SectionLabel>
        {concealed ? null : (
          <OutlinedChip
            testID="correction-type"
            text={correctionType}
            accessibilityLabel={fill(strings.correctionType, { type: correctionType })}
            size="roomy"
          />
        )}
      </View>
      <View
        testID="correction-non-standard"
        accessible
        accessibilityLabel={`${strings.nonStandard}: ${card.nonStandardForm}`}
        {...voice}
        {...turnActions}
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
      <View>
        {/* Decor slot 2 with an arrow from the non-standard form to the standard one. */}
        <OrnamentDivider centre="arrow" />
      </View>
      {concealed ? (
        <Text
          testID="correction-how-to-say"
          {...voice}
          style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}
        >
          {strings.howToSay}
        </Text>
      ) : (
        <>
          <View style={styles.form}>
            <View
              testID="correction-standard"
              accessible
              accessibilityLabel={`${strings.standard}: ${card.mainEquivalent}`}
              {...voice}
              {...turnActions}
              style={styles.form}
            >
              <Text style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
                {strings.standard}
              </Text>
              <WholeWordsText
                text={card.mainEquivalent}
                size={mainSize}
                tracking={-0.01}
                // A phrase wraps; a single word shrinks to fit rather than break.
                numberOfLines={card.mainEquivalent.includes(' ') ? 3 : 1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={[
                  styles.mainEquivalent,
                  { color: colors.ink, fontFamily: fontFamilies.word },
                ]}
              />
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
              accessibilityLabel={fill(strings.exampleStandard, {
                text: card.examplePair.standard,
              })}
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
          {card.sourceTitles.length === 0 ? null : (
            <Text
              testID="correction-source"
              {...voice}
              style={[styles.source, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {fill(strings.source, { source: card.sourceTitles.join(SOURCE_SEPARATOR) })}
            </Text>
          )}
        </>
      )}
    </>
  );
}

/** The mark before a sentence of the example pair, centred on its first line. */
function Mark({ lineHeight, children }: { lineHeight: number; children: ReactNode }) {
  return (
    <View style={[styles.mark, { height: lineHeight }]}>
      <Svg
        width={correctionCardLayout.exampleMark}
        height={correctionCardLayout.exampleMark}
        viewBox="0 0 24 24"
      >
        {children}
      </Svg>
    </View>
  );
}

/** What sits between the titles of a Correction's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { flexShrink: 1 },
  form: { gap: space[2] },
  label: { fontSize: typeSize.body, fontWeight: '500' },
  nonStandardForm: {
    fontSize: typeSize.sheetTitle,
    lineHeight: typeSize.sheetTitle * 1.2,
    fontWeight: '400',
    textDecorationLine: 'line-through',
  },
  mainEquivalent: { fontWeight: '500' },
  body: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
  explanation: { fontSize: typeSize.explanation, lineHeight: typeSize.explanation * 1.55 },
  examplePair: { gap: space[3], paddingVertical: space[4], paddingHorizontal: space[4] },
  exampleRow: { flexDirection: 'row', gap: space[3] },
  source: { fontSize: typeSize.meta, lineHeight: typeSize.meta * 1.4 },
  mark: { width: correctionCardLayout.exampleMark, justifyContent: 'center' },
  sentence: { flex: 1 },
});
