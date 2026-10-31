import {
  partOfSpeechText,
  registerText,
  STRESS_MARK,
  stressLabel,
  withoutStress,
  type Example,
  type LocalDate,
  type WordCardModel,
} from '@slovo/core';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { OrnamentDivider } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { SectionLabel } from '../primitives/headings';
import { OutlinedChip } from '../primitives/OutlinedChip';
import { blockGap, minTouchTarget, space, typeSize, wordCardControls } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { useIsPageOnScreen, usePageTurnActions } from '../primitives/VerticalPager';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { WordOfTheDayBadge } from './WordOfTheDayBadge';
import { CategoryChip } from './CategoryChip';

/**
 * The Word card's blocks inside the Entry card's frame: the Lemma with Stress,
 * part of speech and register chips, the dialectal one with the region, the primary Definition, the first
 * Example, the Illustration above the Definition, the Word History under its heading, Synonyms and antonyms, the Category chip, the details behind
 * "more", the Synonym Row the Word is a member of and the linked Corrections. It draws only the sections the Core put
 * in the card, at the user's font size. Under Self-check it keeps the Lemma,
 * part of speech and Category; the Entry card draws the button that reveals
 * the rest under them. Where the Stress falls, the Lemma's Stress mark falls
 * onto its vowel each time the card comes on screen, unless the reader turned
 * on Reduce Motion (ADR 0055).
 */
export function WordCardBody({
  card,
  wordOfTheDay,
  compact,
  lemmaSize,
  onOpenCorrection,
  onOpenSynonymRow,
  concealed,
  stressFalls,
  wordOfTheDayFont,
}: {
  card: WordCardModel;
  /** On the card of the Word of the Day: the local day it is the Word of. */
  wordOfTheDay: LocalDate | undefined;
  /** The design's compact iPhone SE layout. */
  compact: boolean;
  /** The Lemma's size at the user's font size, smaller in the compact layout. */
  lemmaSize: TextSize;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  /** Self-check: only the Lemma, part of speech and Category. */
  concealed: boolean;
  /** The falling Stress: on a Word card in the Feed and on the Entry screen, while its Feature Switch is on. */
  stressFalls: boolean;
  /** The calligraphic font family the Lemma is set in on the card of the Word of the Day. */
  wordOfTheDayFont: string | undefined;
}) {
  const { colors, fontFamilies } = useTokens();
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice, Pronunciation } = edition;
  const strings = edition.strings.wordCard;
  const { categoryName } = card;
  // The same Illustration in light and dark mode; a file the app lacks shows none (ADR 0055).
  const illustration =
    card.illustration === undefined ? undefined : edition.illustrations[card.illustration];
  // In the Feed, VoiceOver turns to the next or previous card from the Lemma and the Definition.
  const turnActions = usePageTurnActions();
  // A page of the Feed comes on screen again each time the reader turns back to it.
  const onScreen = useIsPageOnScreen();
  const reduceMotion = useReduceMotionKnown();
  // Until the system answers on Reduce Motion, and while the page is off screen,
  // as when a drag shows it beside the current one, the mark waits unseen above its vowel.
  const falling =
    stressFalls && reduceMotion !== true && card.stressedVowels.length > 0
      ? { mark: STRESS_MARK, playing: onScreen && reduceMotion === false }
      : undefined;
  const lemmaFont =
    (wordOfTheDay === undefined ? undefined : wordOfTheDayFont) ?? fontFamilies.word;

  const grammar = (form: 'short' | 'full') => partOfSpeechText(strings, card, form);

  const categoryChip =
    categoryName === undefined ? null : <CategoryChip testID="word-category" name={categoryName} />;
  const relations = [
    { key: 'synonyms', words: card.synonyms, one: strings.synonym, many: strings.synonyms },
    { key: 'antonyms', words: card.antonyms, one: strings.antonym, many: strings.antonyms },
  ].filter(({ words }) => words.length > 0);

  return (
    <>
      {wordOfTheDay === undefined ? null : <WordOfTheDayBadge day={wordOfTheDay} />}
      <View style={styles.header}>
        <View style={styles.headline}>
          <WholeWordsText
            text={card.lemma}
            size={lemmaSize}
            tracking={-0.01}
            testID="word-lemma"
            falling={falling}
            accessibilityRole="header"
            // The voices skip the Stress mark, so VoiceOver also says where it falls.
            accessibilityLabel={stressLabel(strings, card.lemma, card.stressedVowels)}
            {...voice}
            {...turnActions}
            // A long Lemma shrinks to fit rather than break inside a word.
            numberOfLines={card.lemma.includes(' ') ? 2 : 1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[styles.lemma, { color: colors.ink, fontFamily: lemmaFont }]}
          />
          <View style={styles.grammar}>
            <Text
              testID="word-part-of-speech"
              accessibilityLabel={grammar('full')}
              {...voice}
              style={[styles.partOfSpeech, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {grammar('short')}
            </Text>
            {!concealed &&
              card.registers.map((register) => (
                <OutlinedChip
                  key={register}
                  testID={`word-register-${register}`}
                  text={registerText(strings, register, card.region, 'short')}
                  accessibilityLabel={registerText(strings, register, card.region, 'full')}
                  size="tight"
                />
              ))}
          </View>
        </View>
        {Pronunciation === undefined ? null : <Pronunciation lemma={card.lemma} entryId={card.wordId} />}
      </View>
      <View>
        {/* Decor slot 2, between the header and the Definition. */}
        <OrnamentDivider />
      </View>
      {concealed ? (
        categoryChip
      ) : (
        <>
          {illustration === undefined ? null : (
            <Image
              testID="word-illustration"
              source={illustration}
              accessible
              accessibilityRole="image"
              accessibilityLabel={fill(strings.illustration, { lemma: withoutStress(card.lemma) })}
              {...voice}
              {...turnActions}
              resizeMode="contain"
              style={styles.illustration}
            />
          )}
          <Text
            testID="word-definition"
            // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
            accessibilityLabel={withoutStress(card.primaryDefinition)}
            {...voice}
            {...turnActions}
            style={[sizes.definition, { color: colors.ink, fontFamily: fontFamilies.word }]}
          >
            {card.primaryDefinition}
          </Text>
          {card.example === undefined ? null : (
            <ExampleText testID="word-example" example={card.example} size={sizes.example} />
          )}
          {card.history === undefined ? null : (
            <DetailSection testID="word-history" title={strings.history}>
              <Text
                accessibilityLabel={withoutStress(card.history)}
                {...voice}
                style={[
                  styles.sectionText,
                  { color: colors.inkSecondary, fontFamily: fontFamilies.ui },
                ]}
              >
                {card.history}
              </Text>
            </DetailSection>
          )}
          {relations.length === 0 && !compact ? null : (
            <View style={compact ? styles.compactRow : styles.relations}>
              {relations.length === 0 ? null : (
                <View style={[styles.relations, compact && styles.compactRelations]}>
                  {relations.map(({ key, words, one, many }) => (
                    <Text
                      key={key}
                      testID={`word-${key}`}
                      accessibilityLabel={withoutStress(
                        `${words.length === 1 ? one : many} ${words.join(', ')}`,
                      )}
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
          {card.details === undefined ? null : <Details details={card.details} />}
          {card.synonymRow === undefined ? null : (
            <SynonymRowLine synonymRow={card.synonymRow} onOpen={onOpenSynonymRow} />
          )}
          {card.linkedCorrections.length === 0 ? null : (
            <View
              testID="word-often-said"
              {...voice}
              style={[styles.oftenSaid, { borderTopColor: colors.line }]}
            >
              <Svg
                width={wordCardControls.oftenSaidIcon}
                height={wordCardControls.oftenSaidIcon}
                viewBox="0 0 24 24"
                fill="none"
              >
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
                  style={[
                    styles.oftenSaidText,
                    { color: colors.muted, fontFamily: fontFamilies.ui },
                  ]}
                >
                  {strings.oftenSaid}
                </Text>
                {card.linkedCorrections.map(({ correctionId, nonStandardForm }, index) => (
                  <Pressable
                    key={correctionId}
                    testID={`word-often-said-${correctionId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${strings.oftenSaid} ${withoutStress(nonStandardForm)}`}
                    accessibilityHint={strings.oftenSaidHint}
                    {...voice}
                    disabled={onOpenCorrection === undefined}
                    // The 14 pt line grows to a full touch target.
                    hitSlop={{ top: space[4], bottom: space[4], left: space[1], right: space[1] }}
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
        </>
      )}
    </>
  );
}

/** An Example in italics, with its author's line only when the source names one. */
/**
 * «У синонімічному ряду: {домінанта}», the row the Word is a member of, as a
 * button that opens the row (ADR 0051).
 */
function SynonymRowLine({
  synonymRow: { synonymRowId, dominant },
  onOpen,
}: {
  synonymRow: NonNullable<WordCardModel['synonymRow']>;
  onOpen: ((synonymRowId: string) => void) | undefined;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  // The dominant stands out as the link inside the Edition's sentence around it.
  const [before = '', after = ''] = strings.wordCard.synonymRow.split('{dominant}');
  return (
    <Pressable
      testID="word-synonym-row"
      accessibilityRole="button"
      accessibilityLabel={fill(strings.wordCard.synonymRow, {
        dominant: stressLabel(strings.wordCard, dominant.text, dominant.stressedVowels),
      })}
      accessibilityHint={strings.wordCard.synonymRowHint}
      {...voice}
      disabled={onOpen === undefined}
      // The one line grows to a full touch target.
      hitSlop={{ top: space[3], bottom: space[3] }}
      onPress={() => onOpen?.(synonymRowId)}
      style={styles.synonymRow}
    >
      <Text style={[styles.relation, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {before}
        <Text
          style={[
            styles.synonymRowDominant,
            { color: colors.accent, fontFamily: fontFamilies.word },
          ]}
        >
          {dominant.text}
        </Text>
        {after}
      </Text>
    </Pressable>
  );
}

export function ExampleText({
  example,
  size,
  testID,
}: {
  example: Example;
  size: TextSize;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const text = fill(strings.wordCard.example, { text: example.text });
  const author =
    example.author === undefined
      ? undefined
      : fill(strings.wordCard.exampleAuthor, { author: example.author });
  return (
    <View
      testID={testID}
      accessible
      // The Example and its author's line, as VoiceOver joins them, without the Stress marks.
      accessibilityLabel={withoutStress(author === undefined ? text : `${text}, ${author}`)}
      {...voice}
    >
      <Text
        style={[
          styles.example,
          size,
          { color: colors.inkSecondary, fontFamily: fontFamilies.word },
        ]}
      >
        {text}
      </Text>
      {author === undefined ? null : (
        <Text style={[styles.author, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
          {author}
        </Text>
      )}
    </View>
  );
}

/** "More": the etymology, extra Definitions and further Examples, opened on demand. */
function Details({ details }: { details: NonNullable<WordCardModel['details']> }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
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
          {strings.wordCard.more}
        </Text>
        <Svg
          width={wordCardControls.moreChevron}
          height={wordCardControls.moreChevron}
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
            <DetailSection title={strings.wordCard.extraDefinitions}>
              {details.extraDefinitions.map((definition, index) => (
                <Text
                  key={index}
                  accessibilityLabel={withoutStress(`${String(index + 2)}. ${definition}`)}
                  {...voice}
                  style={bodyText}
                >
                  {/* The primary Definition is the first; these number on from 2. */}
                  {`${String(index + 2)}. ${definition}`}
                </Text>
              ))}
            </DetailSection>
          )}
          {details.examples.length === 0 ? null : (
            <DetailSection title={strings.wordCard.moreExamples}>
              {details.examples.map((example, index) => (
                <ExampleText key={index} example={example} size={sizes.example} />
              ))}
            </DetailSection>
          )}
          {details.etymology === undefined ? null : (
            <DetailSection title={strings.wordCard.etymology}>
              <Text
                accessibilityLabel={withoutStress(details.etymology)}
                {...voice}
                style={[
                  styles.sectionText,
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

/** A titled section of a card, such as «Етимологія». */
export function DetailSection({
  title,
  testID,
  children,
}: {
  title: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View testID={testID} style={styles.detailSection}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

/** The tallest an Illustration is drawn, in points (ADR 0055). */
const ILLUSTRATION_HEIGHT = 160;

const styles = StyleSheet.create({
  illustration: { width: '100%', height: ILLUSTRATION_HEIGHT },
  // Over the blocks below it, so the Pronunciation message can open over them.
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], zIndex: 1 },
  headline: { flex: 1, minWidth: 0, gap: space[2] },
  lemma: { fontWeight: '500' },
  grammar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  partOfSpeech: { fontSize: typeSize.partOfSpeech, fontWeight: '500' },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1], fontSize: typeSize.meta, fontWeight: '500' },
  relations: { gap: space[1] },
  relation: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.4 },
  synonymRow: { alignSelf: 'flex-start' },
  synonymRowDominant: { fontWeight: '500' },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  // On the SE the relations share a row with the Category chip, which keeps its width.
  compactRelations: { flex: 1, minWidth: 0 },
  // A full touch target that looks no taller than its label.
  moreButton: {
    alignSelf: 'flex-start',
    minHeight: minTouchTarget,
    marginVertical: -space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: wordCardControls.moreGap,
  },
  moreText: { fontSize: typeSize.body, fontWeight: '700' },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  // The details keep the card's gap between blocks.
  details: { gap: blockGap, marginTop: space[4] },
  detailSection: { gap: space[2] },
  // The text under a section heading: the Word History and the etymology.
  sectionText: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
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
