import type { EditionStrings } from '@slovo/contracts';
import type { Example, WordCardModel } from '@slovo/core';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useWordTextSizes, type TextSize } from './FontSizeProvider';
import { minTouchTarget, space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';
import { usePageTurnActions } from './VerticalPager';

/** The Edition's Word card strings. */
export type WordCardStrings = EditionStrings['wordCard'];

export interface WordCardProps {
  /** What the card shows, as the Core built it. */
  card: WordCardModel;
  strings: WordCardStrings;
  /** The display name of the card's Category, from the Edition. */
  categoryName: string | undefined;
  /** The Edition's language (BCP 47), so VoiceOver reads the card in its voice. */
  language?: string;
  /** A badge over the Lemma, such as the Word of the Day's. */
  badge?: ReactNode;
  /** Decor drawn over the card's edges, such as corner ornaments (Decor slot 3). */
  frame?: ReactNode;
  /** Decor between the header and the Definition, such as an ornament divider (Decor slot 2). */
  divider?: ReactNode;
  /** The Pronunciation button, at the right of the Lemma. */
  pronunciation?: ReactNode;
  /** Opens a linked Correction when the reader taps its form in the «often said» line. */
  onOpenCorrection?: (correctionId: string) => void;
}

/** Below this window width the card takes the design's compact iPhone SE layout. */
export const COMPACT_WIDTH = 390;

/** On the SE the Lemma drops from 48 to 44 at M, and the padding shrinks by 25%. */
export const COMPACT_LEMMA = 44 / 48;
export const COMPACT_PADDING = 0.75;

/** `{name}` placeholders filled from `values`. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

/** A `#RRGGBB` colour at the given opacity; any other colour as it is. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (hex === null) return color;
  const [r, g, b] = hex.slice(1).map((pair) => parseInt(pair, 16));
  return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
}

/**
 * The Word card: the Lemma with Stress, part of speech and register chips,
 * the primary Definition, the first Example, Synonyms and antonyms, the
 * Category chip, the details behind "more" and the linked Corrections. It
 * draws only the sections the Core put in the card, at the user's font size.
 */
export function WordCard({
  card,
  strings,
  categoryName,
  language,
  badge,
  frame,
  divider,
  pronunciation,
  onOpenCorrection,
}: WordCardProps) {
  const { colors, fontFamilies, radii } = useTokens();
  const sizes = useWordTextSizes();
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  const lemmaSize = compact
    ? {
        fontSize: sizes.lemma.fontSize * COMPACT_LEMMA,
        lineHeight: sizes.lemma.lineHeight * COMPACT_LEMMA,
      }
    : sizes.lemma;
  const padding = compact ? COMPACT_PADDING : 1;
  const voice = language === undefined ? {} : { accessibilityLanguage: language };
  // In the Feed, VoiceOver turns to the next or previous card from the Lemma and the Definition.
  const turnActions = usePageTurnActions();

  const partOfSpeech = strings.partsOfSpeech[card.partOfSpeech];
  const gender = card.gender === undefined ? undefined : strings.genders[card.gender];
  const grammar = (form: 'short' | 'full') =>
    gender === undefined
      ? partOfSpeech[form]
      : fill(strings.partOfSpeechWithGender, {
          partOfSpeech: partOfSpeech[form],
          gender: gender[form],
        });
  const stressHint =
    card.stressedVowels.length === 0
      ? undefined
      : fill(strings.stress, { vowels: card.stressedVowels.join(` ${strings.stressOr} `) });

  const categoryChip =
    categoryName === undefined ? null : (
      <View
        testID="word-category"
        accessible
        accessibilityLabel={fill(strings.category, { category: categoryName })}
        {...voice}
        style={[
          styles.categoryChip,
          { backgroundColor: colors.surfaceSunken, borderRadius: radii.chip },
        ]}
      >
        <Text style={[styles.categoryText, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
          {categoryName}
        </Text>
      </View>
    );
  const relations = [
    { key: 'synonyms', words: card.synonyms, one: strings.synonym, many: strings.synonyms },
    { key: 'antonyms', words: card.antonyms, one: strings.antonym, many: strings.antonyms },
  ].filter(({ words }) => words.length > 0);

  return (
    <View
      testID="word-card"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderRadius: radii.card,
          paddingTop: space[8] * padding,
          paddingHorizontal: CARD_SIDE * padding,
          paddingBottom: CARD_SIDE * padding,
          gap: CARD_GAP * padding,
        },
      ]}
    >
      {badge}
      <View style={styles.header}>
        <View style={styles.headline}>
          <Text
            testID="word-lemma"
            accessibilityRole="header"
            // The voices skip the Stress mark, so VoiceOver also says where it falls.
            accessibilityLabel={
              stressHint === undefined ? card.lemma : `${card.lemma}, ${stressHint}`
            }
            {...voice}
            {...turnActions}
            // A long Lemma shrinks to fit rather than break inside a word.
            numberOfLines={card.lemma.includes(' ') ? 2 : 1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[
              styles.lemma,
              lemmaSize,
              { letterSpacing: lemmaSize.fontSize * -0.01 },
              { color: colors.ink, fontFamily: fontFamilies.word },
            ]}
          >
            {card.lemma}
          </Text>
          <View style={styles.grammar}>
            <Text
              testID="word-part-of-speech"
              accessibilityLabel={grammar('full')}
              {...voice}
              style={[styles.partOfSpeech, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {grammar('short')}
            </Text>
            {card.registers.map((register) => (
              <View
                key={register}
                testID={`word-register-${register}`}
                accessible
                accessibilityLabel={strings.registers[register].full}
                {...voice}
                style={[
                  styles.registerChip,
                  { borderColor: withAlpha(colors.accent, 0.45), borderRadius: radii.chip },
                ]}
              >
                <Text
                  style={[
                    styles.registerText,
                    { color: colors.accent, fontFamily: fontFamilies.ui },
                  ]}
                >
                  {strings.registers[register].short}
                </Text>
              </View>
            ))}
          </View>
        </View>
        {pronunciation}
      </View>
      {divider === undefined ? null : <View>{divider}</View>}
      <Text
        testID="word-definition"
        {...voice}
        {...turnActions}
        style={[sizes.definition, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {card.primaryDefinition}
      </Text>
      {card.example === undefined ? null : (
        <ExampleText
          testID="word-example"
          example={card.example}
          strings={strings}
          size={sizes.example}
          voice={voice}
        />
      )}
      {relations.length === 0 && !compact ? null : (
        <View style={compact ? styles.compactRow : styles.relations}>
          {relations.length === 0 ? null : (
            <View style={[styles.relations, compact && styles.compactRelations]}>
              {relations.map(({ key, words, one, many }) => (
                <Text
                  key={key}
                  testID={`word-${key}`}
                  {...voice}
                  style={[
                    styles.relation,
                    { color: colors.inkSecondary, fontFamily: fontFamilies.ui },
                  ]}
                >
                  <Text style={{ color: colors.muted }}>{words.length === 1 ? one : many}</Text>{' '}
                  {words.join(', ')}
                </Text>
              ))}
            </View>
          )}
          {compact ? categoryChip : null}
        </View>
      )}
      {compact ? null : categoryChip}
      {card.details === undefined ? null : (
        <Details details={card.details} strings={strings} voice={voice} />
      )}
      {card.linkedCorrections.length === 0 ? null : (
        <View
          testID="word-often-said"
          {...voice}
          style={[styles.oftenSaid, { borderTopColor: colors.line }]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"
              stroke={colors.accent}
              strokeWidth={1.8}
            />
          </Svg>
          <View style={styles.oftenSaidLine}>
            {/* Each form below says the label for VoiceOver. */}
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.oftenSaidText, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {strings.oftenSaid}
            </Text>
            {card.linkedCorrections.map(({ correctionId, nonStandardForm }, index) => (
              <Pressable
                key={correctionId}
                testID={`word-often-said-${correctionId}`}
                accessibilityRole="button"
                accessibilityLabel={`${strings.oftenSaid} ${nonStandardForm}`}
                accessibilityHint={strings.oftenSaidHint}
                {...voice}
                disabled={onOpenCorrection === undefined}
                hitSlop={{ top: space[3], bottom: space[3] }}
                onPress={() => onOpenCorrection?.(correctionId)}
              >
                <Text
                  style={[
                    styles.oftenSaidForms,
                    { color: colors.inkSecondary, fontFamily: fontFamilies.word },
                  ]}
                >
                  {index < card.linkedCorrections.length - 1
                    ? `${nonStandardForm},`
                    : nonStandardForm}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {frame === undefined ? null : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {frame}
        </View>
      )}
    </View>
  );
}

/** The props that give VoiceOver the Edition's language. */
interface Voice {
  accessibilityLanguage?: string;
}

/** An Example in italics, with its author's line only when the source names one. */
function ExampleText({
  example,
  strings,
  size,
  voice,
  testID,
}: {
  example: Example;
  strings: WordCardStrings;
  size: TextSize;
  voice: Voice;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View testID={testID} accessible {...voice}>
      <Text
        style={[
          styles.example,
          size,
          { color: colors.inkSecondary, fontFamily: fontFamilies.word },
        ]}
      >
        {fill(strings.example, { text: example.text })}
      </Text>
      {example.author === undefined ? null : (
        <Text style={[styles.author, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
          {fill(strings.exampleAuthor, { author: example.author })}
        </Text>
      )}
    </View>
  );
}

/** "More": the etymology, extra Definitions and further Examples, opened on demand. */
function Details({
  details,
  strings,
  voice,
}: {
  details: NonNullable<WordCardModel['details']>;
  strings: WordCardStrings;
  voice: Voice;
}) {
  const { colors, fontFamilies } = useTokens();
  const sizes = useWordTextSizes();
  const [open, setOpen] = useState(false);
  const bodyText = [sizes.example, { color: colors.ink, fontFamily: fontFamilies.word }];
  return (
    <View>
      <Pressable
        testID="word-more"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        {...voice}
        hitSlop={{ left: space[2], right: space[2] }}
        onPress={() => {
          setOpen((current) => !current);
        }}
        style={styles.moreButton}
      >
        <Text style={[styles.moreText, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
          {strings.more}
        </Text>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          style={open ? styles.chevronOpen : undefined}
        >
          <Path d="M6 9l6 6 6-6" stroke={colors.accent} strokeWidth={2.2} />
        </Svg>
      </Pressable>
      {open ? (
        <View testID="word-details" style={styles.details}>
          {details.extraDefinitions.length === 0 ? null : (
            <DetailSection title={strings.extraDefinitions} voice={voice}>
              {details.extraDefinitions.map((definition, index) => (
                <Text key={index} {...voice} style={bodyText}>
                  {/* The primary Definition is the first; these number on from 2. */}
                  {`${String(index + 2)}. ${definition}`}
                </Text>
              ))}
            </DetailSection>
          )}
          {details.examples.length === 0 ? null : (
            <DetailSection title={strings.moreExamples} voice={voice}>
              {details.examples.map((example, index) => (
                <ExampleText
                  key={index}
                  example={example}
                  strings={strings}
                  size={sizes.example}
                  voice={voice}
                />
              ))}
            </DetailSection>
          )}
          {details.etymology === undefined ? null : (
            <DetailSection title={strings.etymology} voice={voice}>
              <Text
                {...voice}
                style={[
                  styles.etymology,
                  { color: colors.inkSecondary, fontFamily: fontFamilies.ui },
                ]}
              >
                {details.etymology}
              </Text>
            </DetailSection>
          )}
        </View>
      ) : null}
    </View>
  );
}

function DetailSection({
  title,
  voice,
  children,
}: {
  title: string;
  voice: Voice;
  children: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View style={styles.detailSection}>
      <Text
        accessibilityRole="header"
        {...voice}
        style={[styles.overline, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Padding 32 / 26 / 26 from the design; 18 between blocks. */
const CARD_SIDE = 26;
const CARD_GAP = 18;

const styles = StyleSheet.create({
  // The border is the card's only elevation.
  card: { borderWidth: 1 },
  // Over the blocks below it, so the Pronunciation message can open over them.
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], zIndex: 1 },
  headline: { flex: 1, minWidth: 0, gap: space[2] },
  lemma: { fontWeight: '500' },
  grammar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  partOfSpeech: { fontSize: typeSize.partOfSpeech, fontWeight: '500' },
  registerChip: { borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  registerText: { fontSize: 11.5, fontWeight: '600' },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1], fontSize: 13, fontWeight: '500' },
  relations: { gap: space[1] },
  relation: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  // On the SE the relations share a row with the Category chip, which keeps its width.
  compactRelations: { flex: 1, minWidth: 0 },
  categoryChip: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: space[3],
    paddingVertical: 7,
  },
  categoryText: { fontSize: 12.5, fontWeight: '600' },
  // A full touch target that looks no taller than its label.
  moreButton: {
    alignSelf: 'flex-start',
    minHeight: minTouchTarget,
    marginVertical: -space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moreText: { fontSize: typeSize.body, fontWeight: '700' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  details: { gap: CARD_GAP, marginTop: space[4] },
  detailSection: { gap: space[2] },
  overline: {
    fontSize: typeSize.overline,
    fontWeight: '700',
    letterSpacing: typeSize.overline * 0.14,
    textTransform: 'uppercase',
  },
  etymology: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  oftenSaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingTop: space[3],
    borderTopWidth: 1,
  },
  oftenSaidLine: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: space[2],
  },
  oftenSaidText: { fontSize: typeSize.partOfSpeech, fontWeight: '500' },
  oftenSaidForms: { fontSize: typeSize.partOfSpeech, fontStyle: 'italic', fontWeight: '400' },
});
