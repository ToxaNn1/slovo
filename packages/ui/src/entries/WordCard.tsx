import {
  partOfSpeechText,
  registerText,
  STRESS_MARK,
  stressLabel,
  withoutStress,
  type Example,
  type WordCardModel,
} from '@slovo/core';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { WholeLinesText } from '../primitives/WholeLines';
import Svg, { Path } from 'react-native-svg';

import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { SectionLabel } from '../primitives/headings';
import { LabelChip } from '../primitives/LabelChip';
import { Wedge } from '../primitives/Wedge';
import {
  blockGap,
  entryCardFrame,
  illustrationHeight,
  minTouchTarget,
  space,
  typeStyle,
  wedges,
  wordCardControls,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useOnAccent } from './on-accent';
import { useIsPageOnScreen, usePageTurnActions } from '../primitives/VerticalPager';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { RevealDetail, useFlyingText } from './reveal';
import { capitalised } from './capitalised';
import { NumberedDefinitions } from './NumberedDefinitions';
import { CategoryChip } from './CategoryChip';

/**
 * The Word's headline: the Lemma with its falling Stress, part of speech and
 * register chips, and the Pronunciation button beside them; on the tabbed
 * card (`tabbed`) the Category chip ends the grammar line and the button
 * sits at its right end (board p1). Off the red ground the stressed letter is red over a red rule under the Lemma (board
 * p1); on it (`useOnAccent`) it is set in the key ink of both Themes.
 */
export function WordHeadline({
  card,
  lemmaSize,
  concealed,
  stressFalls,
  lemmaFont: calligraphic,
  tabbed,
}: {
  card: WordCardModel;
  lemmaSize: TextSize;
  /** Self-check: no register chips yet. */
  concealed: boolean;
  stressFalls: boolean;
  /** The calligraphic font family of the Word of the Day's Lemma, if it is set in one. */
  lemmaFont: string | undefined;
  /** The tabbed card's headline (ADR 0091, board p1). */
  tabbed: boolean;
}) {
  const tokens = useTokens();
  const { fontFamilies } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const onAccent = useOnAccent();
  const colors = onAccent ? { ink: keyInk, muted: keyInk } : tokens.colors;
  const edition = useEdition();
  const { voice, Pronunciation } = edition;
  const strings = edition.strings.wordCard;
  const turnActions = usePageTurnActions();
  const flying = useFlyingText();
  const onScreen = useIsPageOnScreen();
  const reduceMotion = useReduceMotionKnown();
  // Until the system answers on Reduce Motion, and while the page is off screen,
  // as when a drag shows it beside the current one, the mark waits unseen above its vowel.
  const falling =
    stressFalls && reduceMotion !== true && card.stressedVowels.length > 0
      ? { mark: STRESS_MARK, playing: onScreen && reduceMotion === false }
      : undefined;
  const lemmaFont = calligraphic ?? fontFamilies.word;
  const grammar = (form: 'short' | 'full') => partOfSpeechText(strings, card, form);
  // The tabbed card keeps its Category chip in the grammar line, even under Self-check.
  const category = tabbed ? card.categoryName : undefined;
  const pronunciation =
    Pronunciation === undefined ? null : <Pronunciation lemma={card.lemma} entryId={card.wordId} />;
  const grammarLine = (
    <>
      <Text
        testID="word-part-of-speech"
        accessibilityLabel={grammar('full')}
        {...voice}
        style={[typeStyle('partOfSpeech', tokens), { color: colors.muted }]}
      >
        {capitalised(grammar('short'), voice.accessibilityLanguage)}
      </Text>
      {!concealed &&
        card.registers.map((register) => (
          <LabelChip
            key={register}
            testID={`word-register-${register}`}
            text={capitalised(
              registerText(strings, register, card.region, 'short'),
              voice.accessibilityLanguage,
            )}
            accessibilityLabel={registerText(strings, register, card.region, 'full')}
            size="tight"
          />
        ))}
      {category === undefined ? null : <CategoryChip testID="word-category" name={category} />}
    </>
  );
  return (
    <View style={styles.header}>
      <View style={styles.headline}>
        <WholeWordsText
          flying={flying}
          text={capitalised(card.lemma, voice.accessibilityLanguage)}
          size={lemmaSize}
          typeRole="heroWord"
          testID="word-lemma"
          falling={falling}
          accessibilityRole="header"
          // The voices skip the Stress mark, so VoiceOver also says where it falls.
          accessibilityLabel={stressLabel(strings, card.lemma, card.stressedVowels)}
          {...voice}
          {...turnActions}
          lines={2}
          stressed={
            onAccent ? undefined : { mark: STRESS_MARK, style: { color: tokens.colors.accent } }
          }
          style={[
            typeStyle('heroWord', { fontFamilies: { ...fontFamilies, word: lemmaFont } }),
            { color: colors.ink },
          ]}
        />
        {!onAccent && (
          <Wedge
            testID="word-rule"
            points={wedges.slant}
            color={tokens.colors.accent}
            width={entryCardFrame.rule.width}
            height={entryCardFrame.rule.height}
          />
        )}
        <RevealDetail step={0}>
          {tabbed ? (
            <View testID="word-grammar" style={styles.grammarRow}>
              <View style={[styles.grammar, styles.grammarLine]}>{grammarLine}</View>
              {pronunciation}
            </View>
          ) : (
            <View testID="word-grammar" style={styles.grammar}>
              {grammarLine}
            </View>
          )}
        </RevealDetail>
      </View>
      {tabbed ? null : pronunciation}
    </View>
  );
}

/**
 * The Word's meaning under its headline: the Illustration, the primary
 * Definition, the first Example, the Word History, Synonyms and antonyms,
 * the Category chip, the details behind "more", the Synonym Row and the
 * linked Corrections, each only when the Core put it in the card.
 */
export function WordSections({
  card,
  compact,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
}: {
  card: WordCardModel;
  compact: boolean;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  onHistoryShown: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.wordCard;
  const { categoryName } = card;
  const categoryChip =
    categoryName === undefined ? null : <CategoryChip testID="word-category" name={categoryName} />;
  const relations = [
    { key: 'synonyms', words: card.synonyms, one: strings.synonym, many: strings.synonyms },
    { key: 'antonyms', words: card.antonyms, one: strings.antonym, many: strings.antonyms },
  ].filter(({ words }) => words.length > 0);
  return (
    <>
      <WordIllustration card={card} />
      <WordDefinition card={card} />
      {card.example === undefined ? null : (
        <ExampleText testID="word-example" example={card.example} size={sizes.example} />
      )}
      {card.history === undefined ? null : (
        <WordHistory history={card.history} onShown={onHistoryShown} />
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
                  style={[typeStyle('sub', tokens), { color: colors.ink }]}
                >
                  <Text style={{ color: colors.muted }}>{words.length === 1 ? one : many}</Text>{' '}
                  {words.map((word) => capitalised(word, voice.accessibilityLanguage)).join(', ')}
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
      <OftenSaid card={card} onOpenCorrection={onOpenCorrection} />
    </>
  );
}

/**
 * The Word's Illustration above its Definition, the same in both Themes
 * (ADR 0055): none while the device has no file for the Word, drawn when
 * the file arrives (ADR 0099).
 */
export function WordIllustration({ card }: { card: WordCardModel }) {
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.wordCard;
  // In the Feed, VoiceOver turns to the next or previous card from the Lemma and the Definition.
  const turnActions = usePageTurnActions();
  const illustration = edition.useIllustration(card.wordId);
  if (illustration === undefined) return null;
  return (
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
  );
}

/** The Word's primary Definition at the user's font size. */
export function WordDefinition({ card }: { card: WordCardModel }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const { voice } = useEdition();
  const turnActions = usePageTurnActions();
  return (
    <WholeLinesText
      testID="word-definition"
      // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
      accessibilityLabel={withoutStress(card.primaryDefinition)}
      {...voice}
      {...turnActions}
      style={[typeStyle('definition', tokens), sizes.definition, { color: colors.ink }]}
    >
      {capitalised(card.primaryDefinition, voice.accessibilityLanguage)}
    </WholeLinesText>
  );
}

/** «Часто кажуть:» and the non-standard forms of the linked Corrections, each opening its Correction. */
export function OftenSaid({
  card,
  onOpenCorrection,
}: {
  card: WordCardModel;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings: editionStrings, voice } = useEdition();
  const strings = editionStrings.wordCard;
  if (card.linkedCorrections.length === 0) return null;
  return (
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
          style={[typeStyle('meta', tokens), { color: colors.muted }]}
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
              style={[typeStyle('oftenSaidForm', tokens), styles.italic, { color: colors.ink }]}
            >
              {index < card.linkedCorrections.length - 1
                ? `${capitalised(nonStandardForm, voice.accessibilityLanguage)},`
                : capitalised(nonStandardForm, voice.accessibilityLanguage)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * The Word History under its heading: how the Word left the language or
 * changed its meaning. The reader reaches it by scrolling, so `onShown` is
 * called once it is drawn, and the caller counts that as the history opened.
 */
export function WordHistory({
  history,
  onShown,
}: {
  history: string;
  onShown: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  useEffect(() => {
    onShown?.();
  }, [onShown]);
  return (
    <DetailSection testID="word-history" title={strings.wordCard.history}>
      <Text
        accessibilityLabel={withoutStress(history)}
        {...voice}
        style={[typeStyle('sectionText', tokens), { color: colors.ink }]}
      >
        {capitalised(history, voice.accessibilityLanguage)}
      </Text>
    </DetailSection>
  );
}

/**
 * «У синонімічному ряду: {домінанта}», the row the Word is a member of, as a
 * button that opens the row (ADR 0051).
 */
export function SynonymRowLine({
  synonymRow: { synonymRowId, dominant },
  onOpen,
}: {
  synonymRow: NonNullable<WordCardModel['synonymRow']>;
  onOpen: ((synonymRowId: string) => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
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
      <Text style={[typeStyle('sub', tokens), { color: colors.muted }]}>
        {before}
        <Text style={[typeStyle('linkWord', tokens), { color: colors.accentText }]}>
          {capitalised(dominant.text, voice.accessibilityLanguage)}
        </Text>
        {after}
      </Text>
    </Pressable>
  );
}

/**
 * An Example in italics, in the Edition's quote marks unless `quoted` is
 * false, with its author's line only when the source names one.
 */
export function ExampleText({
  example,
  size,
  testID,
  quoted = true,
}: {
  example: Example;
  size: TextSize;
  testID?: string;
  /** False under the big opening mark of the tabbed card's «Приклад», which stands for the marks (board p1). */
  quoted?: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const text = quoted ? fill(strings.wordCard.example, { text: example.text }) : example.text;
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
      <WholeLinesText
        style={[typeStyle('example', tokens), size, styles.italic, { color: colors.ink }]}
      >
        {capitalised(text, voice.accessibilityLanguage)}
      </WholeLinesText>
      {author === undefined ? null : (
        <WholeLinesText style={[typeStyle('meta', tokens), styles.author, { color: colors.muted }]}>
          {capitalised(author, voice.accessibilityLanguage)}
        </WholeLinesText>
      )}
    </View>
  );
}

/** "More": the etymology, extra Definitions and further Examples, opened on demand. */
function Details({ details }: { details: NonNullable<WordCardModel['details']> }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const sizes = useWordTextSizes();
  const [open, setOpen] = useState(false);
  const bodyText = [typeStyle('example', tokens), sizes.example, { color: colors.ink }];
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
        <Text style={[typeStyle('textLink', tokens), { color: colors.accentText }]}>
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
              <NumberedDefinitions definitions={details.extraDefinitions} style={bodyText} />
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
                style={[typeStyle('sectionText', tokens), { color: colors.ink }]}
              >
                {capitalised(details.etymology, voice.accessibilityLanguage)}
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

const styles = StyleSheet.create({
  illustration: { width: '100%', height: illustrationHeight },
  // Over the blocks below it, so the Pronunciation message can open over them.
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], zIndex: 1 },
  headline: { flex: 1, minWidth: 0, gap: space[2] },
  grammar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  // The tabbed card's grammar line, the Pronunciation button at its right end.
  grammarRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  grammarLine: { flex: 1, minWidth: 0 },
  italic: { fontStyle: 'italic' },
  author: { marginTop: space[1] },
  relations: { gap: space[1] },
  synonymRow: { alignSelf: 'flex-start' },
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
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  // The details keep the card's gap between blocks.
  details: { gap: blockGap, marginTop: space[4] },
  detailSection: { gap: space[2] },
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
});
