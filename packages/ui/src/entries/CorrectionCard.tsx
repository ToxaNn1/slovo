import { stressLabel, withoutStress, type CorrectionCardModel } from '@slovo/core';
import type { EditionStrings, LiteraryUse } from '@slovo/contracts';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { SectionLabel } from '../primitives/headings';
import { LabelChip } from '../primitives/LabelChip';
import { correctionCardLayout, space, typeStyle, withAlpha } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { CategoryChip } from './CategoryChip';
import { KickerRow } from './KickerRow';
import { DetailSection, ExampleText } from './WordCard';
import { CardTabs } from './CardTabs';
import { correctionTabsOf, type CorrectionTab } from './word-tabs';

/**
 * The Correction card's blocks inside the Entry card's frame: the Correction
 * Type, the non-standard form muted and struck through, the main standard
 * equivalent at the Lemma's size with the others under it, the explanation,
 * the example pair, the Category chip as on the Word card, the Correction's
 * literary uses under their heading, each like a Word's Example with its
 * author, work and year, and, when the Correction has sources, a line naming them.
 * Nothing on the card reads as an error. A stress trap's texts carry their
 * Stress marks (ADR 0045): VoiceOver reads each form with where its Stress
 * falls, as for a Lemma, and every other text without the mark. Under Self-check it keeps only the non-standard form and
 * asks how to say it right; the Entry card draws the button that reveals the
 * rest under it. While `wordTabs` is on, the blocks under the non-standard
 * form sit in the tabs «Як краще», «Чому» and «Приклади» (ADR 0088).
 */
export function CorrectionCardBody({
  card,
  lemmaSize: mainSize,
  concealed,
  corner,
  tabs,
}: {
  card: CorrectionCardModel;
  /** The Lemma's size at the user's font size, which the main standard equivalent takes. */
  lemmaSize: TextSize;
  /** Self-check: only the non-standard form and the question. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The tabs under the non-standard form in place of the one column, while `wordTabs` is on (ADR 0088). */
  tabs: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.correctionCard;
  const correctionType = strings.correctionTypes[card.correctionType];

  return (
    <>
      <KickerRow testID="correction-kicker-row" corner={corner}>
        {/* The kicker never breaks inside its word: it keeps one line, and the chip goes under it when short of room. */}
        <View testID="correction-kicker" style={styles.header}>
          <SectionLabel oneLine style={styles.title}>
            {strings.title}
          </SectionLabel>
          {concealed ? null : (
            <LabelChip
              testID="correction-type"
              text={correctionType}
              accessibilityLabel={fill(strings.correctionType, { type: correctionType })}
              size="roomy"
            />
          )}
        </View>
      </KickerRow>
      <NonStandardForm
        testID="correction-non-standard"
        form={card.nonStandardForm}
        spoken={stressLabel(
          edition.strings.wordCard,
          card.nonStandardForm,
          card.nonStandardStressedVowels,
        )}
      />
      {concealed ? (
        <Text
          testID="correction-how-to-say"
          {...voice}
          style={[typeStyle('formLabel', tokens), { color: colors.accent }]}
        >
          {strings.howToSay}
        </Text>
      ) : tabs ? (
        <CardTabs
          testID="correction"
          tabs={correctionTabsOf(card)}
          nameOf={({ key }) => strings.tabs[key]}
        >
          {(tab) => <CorrectionTabContent tab={tab} card={card} mainSize={mainSize} />}
        </CardTabs>
      ) : (
        <>
          <CorrectionBlock block="standard" card={card} mainSize={mainSize} />
          <CorrectionBlock block="explanation" card={card} mainSize={mainSize} />
          <CorrectionBlock block="examplePair" card={card} mainSize={mainSize} />
          <CorrectionBlock block="category" card={card} mainSize={mainSize} />
          <CorrectionBlock block="literaryUses" card={card} mainSize={mainSize} />
          <CorrectionBlock block="sources" card={card} mainSize={mainSize} />
        </>
      )}
    </>
  );
}

/**
 * What a Correction card's selected tab shows (ADR 0088): «Як краще» the
 * standard equivalents and the Category chip, «Чому» the explanation and its
 * sources, «Приклади» the example pair and the literary uses.
 */
function CorrectionTabContent({
  tab,
  card,
  mainSize,
}: {
  tab: CorrectionTab;
  card: CorrectionCardModel;
  mainSize: TextSize;
}) {
  const blocks: readonly Block[] =
    tab.key === 'better'
      ? ['standard', 'category']
      : tab.key === 'why'
        ? ['explanation', 'sources']
        : ['examplePair', 'literaryUses'];
  return (
    <>
      {blocks.map((block) => (
        <CorrectionBlock key={block} block={block} card={card} mainSize={mainSize} />
      ))}
    </>
  );
}

/** The blocks of a Correction card under its non-standard form, in the column's order. */
type Block = 'standard' | 'explanation' | 'examplePair' | 'category' | 'literaryUses' | 'sources';

/** One block of a Correction card, which the column and the tabs both draw. */
function CorrectionBlock({
  block,
  card,
  mainSize,
}: {
  block: Block;
  card: CorrectionCardModel;
  mainSize: TextSize;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.correctionCard;
  // The voices skip the Stress mark, so VoiceOver also says where it falls.
  const formLabel = (form: string, stressedVowels: readonly string[]) =>
    stressLabel(edition.strings.wordCard, form, stressedVowels);
  const sentence = [typeStyle('example', tokens), sizes.example];
  switch (block) {
    case 'standard':
      return (
        <View style={styles.form}>
          <StandardForm
            testID="correction-standard"
            form={card.mainEquivalent}
            spoken={formLabel(card.mainEquivalent, card.mainEquivalentStressedVowels)}
            size={mainSize}
          />
          {card.otherEquivalents.length === 0 ? null : (
            <Text
              testID="correction-other-equivalents"
              accessibilityLabel={withoutStress(
                fill(strings.otherEquivalents, { equivalents: card.otherEquivalents.join(', ') }),
              )}
              {...voice}
              style={[typeStyle('sub', tokens), { color: colors.ink }]}
            >
              {fill(strings.otherEquivalents, { equivalents: card.otherEquivalents.join(', ') })}
            </Text>
          )}
        </View>
      );
    case 'explanation':
      return (
        <Text
          testID="correction-explanation"
          accessibilityLabel={withoutStress(card.explanation)}
          {...voice}
          style={[typeStyle('explanation', tokens), { color: colors.ink }]}
        >
          {card.explanation}
        </Text>
      );
    case 'examplePair':
      return (
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
              text: withoutStress(card.examplePair.nonStandard),
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
              text: withoutStress(card.examplePair.standard),
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
      );
    case 'category':
      return card.categoryName === undefined ? null : (
        <CategoryChip testID="correction-category" name={card.categoryName} />
      );
    case 'literaryUses':
      return card.literaryUses.length === 0 ? null : (
        <DetailSection testID="correction-literary-uses" title={strings.literaryUses}>
          {card.literaryUses.map((use) => (
            <ExampleText
              key={`${use.author}-${use.text}`}
              example={{ text: use.text, author: literaryUseSource(strings, use) }}
              size={sizes.example}
            />
          ))}
        </DetailSection>
      );
    case 'sources':
      return card.sourceNames.length === 0 ? null : (
        <Text
          testID="correction-source"
          {...voice}
          style={[typeStyle('meta', tokens), { color: colors.muted }]}
        >
          {fill(strings.source, { source: card.sourceNames.join(SOURCE_SEPARATOR) })}
        </Text>
      );
  }
}

/**
 * The non-standard form under the label «Так часто кажуть», muted and struck
 * through, as one element VoiceOver reads with its label; the Tip card shows
 * its non-standard form the same way.
 */
export function NonStandardForm({
  form,
  spoken,
  testID,
}: {
  form: string;
  /** What VoiceOver reads for the form, such as with where its Stress falls. */
  spoken: string;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  // In the Feed, VoiceOver turns to the next or previous card from the forms.
  const turnActions = usePageTurnActions();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${strings.correctionCard.nonStandard}: ${spoken}`}
      {...voice}
      {...turnActions}
      style={styles.form}
    >
      <Text style={[typeStyle('formLabel', tokens), { color: colors.muted }]}>
        {strings.correctionCard.nonStandard}
      </Text>
      <Text
        style={[
          typeStyle('nonStandardForm', tokens),
          styles.nonStandardForm,
          {
            color: colors.muted,
            textDecorationColor: withAlpha(colors.accent, 0.55),
          },
        ]}
      >
        {form}
      </Text>
    </View>
  );
}

/**
 * The standard form under the label «Українською краще», at the Lemma's
 * size, as one element VoiceOver reads with its label; the Tip card shows its
 * standard form the same way.
 */
export function StandardForm({
  form,
  spoken,
  size,
  testID,
}: {
  form: string;
  /** What VoiceOver reads for the form, such as with where its Stress falls. */
  spoken: string;
  /** The Lemma's size at the user's font size. */
  size: TextSize;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const turnActions = usePageTurnActions();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${strings.correctionCard.standard}: ${spoken}`}
      {...voice}
      {...turnActions}
      style={styles.form}
    >
      <Text style={[typeStyle('formLabel', tokens), { color: colors.accent }]}>
        {strings.correctionCard.standard}
      </Text>
      <WholeWordsText
        text={form}
        typeRole="heroWord"
        size={size}
        tracking={-0.01}
        // A phrase wraps; a single word shrinks to fit rather than break.
        numberOfLines={form.includes(' ') ? 3 : 1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[typeStyle('heroWord', tokens), { color: colors.ink }]}
      />
    </View>
  );
}

/** The line naming a literary use's author and work, with the work's year when it is known. */
function literaryUseSource(
  strings: EditionStrings['correctionCard'],
  { author, work, workYear }: LiteraryUse,
): string {
  return workYear === undefined
    ? fill(strings.literaryUseSource, { author, work })
    : fill(strings.literaryUseSourceWithYear, { author, work, year: String(workYear) });
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { flexShrink: 1 },
  form: { gap: space[2] },
  nonStandardForm: { textDecorationLine: 'line-through' },
  examplePair: { gap: space[3], paddingVertical: space[4], paddingHorizontal: space[4] },
  exampleRow: { flexDirection: 'row', gap: space[3] },
  mark: { width: correctionCardLayout.exampleMark, justifyContent: 'center' },
  sentence: { flex: 1 },
});
