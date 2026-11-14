import { stressLabel, withoutStress, type CorrectionCardModel } from '@slovo/core';
import type { EditionStrings, LiteraryUse } from '@slovo/contracts';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextLayoutEvent } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import {
  correctionStandardScale,
  correctionStrike,
  entryCardFrame,
  space,
  standardFormScale,
  typeRoles,
  typeStyle,
  withAlpha,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { CategoryChip } from './CategoryChip';
import { EntryKicker } from './EntryKicker';
import { KickerRow } from './KickerRow';
import { DetailSection, ExampleText } from './WordCard';
import { capitalised } from './capitalised';
import { SourceLine } from './SourceLine';
import { CardTabs } from './CardTabs';
import { correctionTabs, type CorrectionTab } from './word-tabs';

/**
 * The Correction card's blocks inside the Entry card's frame (board XEntry2
 * e6): the red kicker, the Correction Type in the line over the non-standard
 * form, which is muted and struck line by line with tilted red bars, the main
 * standard equivalent at a share of the Lemma's size under its label, with the
 * Category chip at the label's right and the other equivalents under it, the
 * explanation, the example pair as plain lines, the wrong one struck and the
 * standard form the content marks in the right one bold (ADR 0117), the Correction's
 * literary uses under their heading, each like a Word's Example with its
 * author, work and year, and, when the Correction has sources, a line naming them.
 * Nothing on the card reads as an error. A stress trap's texts carry their
 * Stress marks (ADR 0045): VoiceOver reads each form with where its Stress
 * falls, as for a Lemma, and every other text without the mark. Under Self-check it keeps only the non-standard form and
 * asks how to say it right; the Entry card draws the button that reveals the
 * rest under it. While `wordTabs` is on, the blocks under the non-standard
 * form sit in the tabs «Як краще», «Чому» and «Приклади» (ADR 0091).
 */
export function CorrectionCardBody({
  card,
  lemmaSize: mainSize,
  concealed,
  corner,
  tabs,
  sourceTab,
}: {
  card: CorrectionCardModel;
  /** The Lemma's size at the user's font size, a share of which the main standard equivalent takes. */
  lemmaSize: TextSize;
  /** Self-check: only the non-standard form and the question. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The tabs under the non-standard form in place of the one column, while `wordTabs` is on (ADR 0091). */
  tabs: boolean;
  /** The last tab «Джерело» with the sources, which leave the other tabs, while `sourceTab` is on (ADR 0116). */
  sourceTab: boolean;
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
        <EntryKicker testID="correction-kicker" label={strings.title} />
      </KickerRow>
      <StruckForm
        form={card.nonStandardForm}
        spoken={stressLabel(
          edition.strings.wordCard,
          card.nonStandardForm,
          card.nonStandardStressedVowels,
        )}
        correctionType={concealed ? undefined : correctionType}
      />
      {concealed && (
        <Text
          testID="correction-how-to-say"
          {...voice}
          style={[typeStyle('formLabel', tokens), { color: colors.accentText }]}
        >
          {strings.howToSay}
        </Text>
      )}
      {tabs ? (
        <CardTabs
          testID="correction"
          tabs={correctionTabs}
          nameOf={({ key }) => strings.tabs[key]}
          sources={sourceTab ? card.sourceNames : undefined}
          disabled={concealed}
        >
          {(tab) => (
            <CorrectionTabContent tab={tab} card={card} mainSize={mainSize} sourceTab={sourceTab} />
          )}
        </CardTabs>
      ) : concealed ? null : (
        <>
          <CorrectionBlock block="standard" card={card} mainSize={mainSize} />
          <CorrectionBlock block="explanation" card={card} mainSize={mainSize} />
          <CorrectionBlock block="examplePair" card={card} mainSize={mainSize} />
          <CorrectionBlock block="literaryUses" card={card} mainSize={mainSize} />
          <CorrectionBlock block="sources" card={card} mainSize={mainSize} />
        </>
      )}
    </>
  );
}

/**
 * What a Correction card's selected tab shows (ADR 0091): «Як краще» the
 * standard equivalents with the Category chip, «Чому» the explanation and its
 * sources, «Приклади» the example pair and the literary uses. While
 * `sourceTab` is on, the sources are in their own tab (ADR 0116).
 */
function CorrectionTabContent({
  tab,
  card,
  mainSize,
  sourceTab,
}: {
  tab: CorrectionTab;
  card: CorrectionCardModel;
  mainSize: TextSize;
  sourceTab: boolean;
}) {
  const blocks: readonly Block[] =
    tab.key === 'better'
      ? ['standard']
      : tab.key === 'why'
        ? sourceTab
          ? ['explanation']
          : ['explanation', 'sources']
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
type Block = 'standard' | 'explanation' | 'examplePair' | 'literaryUses' | 'sources';

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
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.correctionCard;
  // The voices skip the Stress mark, so VoiceOver also says where it falls.
  const formLabel = (form: string, stressedVowels: readonly string[]) =>
    stressLabel(edition.strings.wordCard, form, stressedVowels);
  const sentence = [typeStyle('correctionExample', tokens), sizes.example];
  switch (block) {
    case 'standard':
      return (
        <View style={styles.form}>
          <CorrectionStandard
            form={card.mainEquivalent}
            spoken={formLabel(card.mainEquivalent, card.mainEquivalentStressedVowels)}
            size={mainSize}
            categoryName={card.categoryName}
          />
          {card.otherEquivalents.length === 0 ? null : (
            <WholeLinesText
              testID="correction-other-equivalents"
              accessibilityLabel={withoutStress(
                fill(strings.otherEquivalents, { equivalents: card.otherEquivalents.join(', ') }),
              )}
              {...voice}
              style={[typeStyle('sub', tokens), { color: colors.ink }]}
            >
              {capitalised(
                fill(strings.otherEquivalents, { equivalents: card.otherEquivalents.join(', ') }),
                voice.accessibilityLanguage,
              )}
            </WholeLinesText>
          )}
        </View>
      );
    case 'explanation':
      return (
        <WholeLinesText
          testID="correction-explanation"
          accessibilityLabel={withoutStress(card.explanation)}
          {...voice}
          style={[typeStyle('correctionWhy', tokens), { color: colors.ink }]}
        >
          {capitalised(card.explanation, voice.accessibilityLanguage)}
        </WholeLinesText>
      );
    case 'examplePair':
      return (
        <View testID="correction-example-pair" style={styles.examplePair}>
          <WholeLinesText
            accessibilityLabel={fill(strings.exampleNonStandard, {
              text: withoutStress(card.examplePair.nonStandard),
            })}
            {...voice}
            style={[sentence, styles.wrongSentence, { color: colors.muted }]}
          >
            {capitalised(card.examplePair.nonStandard, voice.accessibilityLanguage)}
          </WholeLinesText>
          <WholeLinesText
            testID="correction-example-standard"
            accessibilityLabel={fill(strings.exampleStandard, {
              text: withoutStress(card.examplePair.standard),
            })}
            {...voice}
            style={[sentence, { color: colors.ink }]}
          >
            {card.examplePair.standardSegments.map((segment, index) => {
              // The sentence starts with a capital, so its first segment does.
              const text =
                index === 0 ? capitalised(segment.text, voice.accessibilityLanguage) : segment.text;
              return segment.kind === 'standardForm' ? (
                <Text key={index} style={typeStyle('correctionExampleStrong', tokens)}>
                  {text}
                </Text>
              ) : (
                text
              );
            })}
          </WholeLinesText>
        </View>
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
      return (
        <SourceLine
          testID="correction-source"
          template={strings.source}
          sourceNames={card.sourceNames}
        />
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
      <WholeLinesText style={[typeStyle('formLabel', tokens), { color: colors.muted }]}>
        {strings.correctionCard.nonStandard}
      </WholeLinesText>
      <WholeWordsText
        text={capitalised(form, voice.accessibilityLanguage)}
        typeRole="nonStandardForm"
        lines={3}
        style={[
          typeStyle('nonStandardForm', tokens),
          styles.nonStandardForm,
          {
            color: colors.muted,
            textDecorationColor: withAlpha(colors.accent, 0.55),
          },
        ]}
      />
    </View>
  );
}

/**
 * The standard form under the label «Українською краще», at a share of the
 * Lemma's size (`standardFormScale`), as one element VoiceOver reads with its
 * label; the Tip card shows its standard form the same way.
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
      <WholeLinesText style={[typeStyle('formLabel', tokens), { color: colors.accentText }]}>
        {strings.correctionCard.standard}
      </WholeLinesText>
      <WholeWordsText
        text={capitalised(form, voice.accessibilityLanguage)}
        typeRole="heroWord"
        size={{
          fontSize: size.fontSize * standardFormScale,
          lineHeight: size.lineHeight * standardFormScale,
        }}
        tracking={-0.01}
        lines={3}
        style={[typeStyle('heroWord', tokens), { color: colors.ink }]}
      />
    </View>
  );
}

/**
 * A Correction's non-standard form on its card (board XEntry2 e6): the line
 * «Так часто кажуть · калька» naming its Correction Type, which Self-check
 * leaves out, over the form, muted and struck with a tilted red bar through
 * the middle of each line it is drawn in, as wide as that line, as one
 * element VoiceOver reads with its label and type.
 */
function StruckForm({
  form,
  spoken,
  correctionType,
}: {
  form: string;
  /** What VoiceOver reads for the form, such as with where its Stress falls. */
  spoken: string;
  /** The Edition's name of the Correction Type; none under Self-check. */
  correctionType: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { nonStandard, correctionType: typeLabel } = strings.correctionCard;
  // In the Feed, VoiceOver turns to the next or previous card from the forms.
  const turnActions = usePageTurnActions();
  // The lines the form is drawn in, each struck on its own; none until it is laid out.
  const [lines, setLines] = useState<TextLayoutEvent['nativeEvent']['lines']>([]);
  return (
    <View
      testID="correction-non-standard"
      accessible
      accessibilityLabel={
        correctionType === undefined
          ? `${nonStandard}: ${spoken}`
          : `${nonStandard}, ${correctionType}: ${spoken}`
      }
      {...voice}
      {...turnActions}
      style={styles.struckForm}
    >
      <WholeLinesText style={[typeStyle('correctionFormLabel', tokens), { color: colors.muted }]}>
        {nonStandard}
        {correctionType === undefined ? null : (
          <>
            {TYPE_SEPARATOR}
            <Text
              testID="correction-type"
              accessibilityLabel={fill(typeLabel, { type: correctionType })}
            >
              {correctionType}
            </Text>
          </>
        )}
      </WholeLinesText>
      <View style={styles.struck}>
        <WholeWordsText
          text={capitalised(form, voice.accessibilityLanguage)}
          typeRole="correctionStruck"
          lines={3}
          style={[typeStyle('correctionStruck', tokens), { color: colors.muted }]}
          onTextLayout={(event) => {
            setLines(event.nativeEvent.lines);
          }}
        />
        {lines.map((line, index) => (
          <View
            key={index}
            testID="correction-non-standard-strike"
            style={[
              styles.strike,
              {
                // The text's room for capital marks is padding inside its view, which
                // starts that much above this one, so its lines sit right where it says.
                top: line.y + (line.height - correctionStrike.thickness) / 2,
                left: line.x - correctionStrike.overhang,
                width: line.width + 2 * correctionStrike.overhang,
                backgroundColor: colors.accent,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * A Correction's main standard equivalent in «Як краще» (board XEntry2 e6):
 * the red label «Українською краще», with the Category chip at its right as
 * on the Word card's grammar line, over the form at a share of the Lemma's
 * size (`correctionStandardScale`), as one element VoiceOver reads with its
 * label and Category.
 */
function CorrectionStandard({
  form,
  spoken,
  size,
  categoryName,
}: {
  form: string;
  /** What VoiceOver reads for the form, such as with where its Stress falls. */
  spoken: string;
  /** The Lemma's size at the user's font size. */
  size: TextSize;
  /** The Correction's Category, if it has one. */
  categoryName: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const turnActions = usePageTurnActions();
  const label = `${strings.correctionCard.standard}: ${spoken}`;
  const { size: roleSize, lineHeight } = typeRoles.correctionStandard;
  const fontSize = size.fontSize * correctionStandardScale;
  return (
    <View
      testID="correction-standard"
      accessible
      accessibilityLabel={
        categoryName === undefined
          ? label
          : `${label}. ${fill(strings.wordCard.category, { category: categoryName })}`
      }
      {...voice}
      {...turnActions}
      style={styles.standard}
    >
      <View testID="correction-standard-label-row" style={styles.labelRow}>
        <WholeLinesText
          style={[
            typeStyle('correctionFormLabel', tokens),
            styles.label,
            { color: colors.accentText },
          ]}
        >
          {strings.correctionCard.standard}
        </WholeLinesText>
        {categoryName === undefined ? null : (
          <CategoryChip testID="correction-category" name={categoryName} />
        )}
      </View>
      <WholeWordsText
        text={capitalised(form, voice.accessibilityLanguage)}
        typeRole="correctionStandard"
        size={{ fontSize, lineHeight: (fontSize * lineHeight) / roleSize }}
        lines={3}
        style={[typeStyle('correctionStandard', tokens), { color: colors.ink }]}
      />
    </View>
  );
}

/** What sits between «Так часто кажуть» and the Correction Type. */
const TYPE_SEPARATOR = ' · ';

/** The line naming a literary use's author and work, with the work's year when it is known. */
function literaryUseSource(
  strings: EditionStrings['correctionCard'],
  { author, work, workYear }: LiteraryUse,
): string {
  return workYear === undefined
    ? fill(strings.literaryUseSource, { author, work })
    : fill(strings.literaryUseSourceWithYear, { author, work, year: String(workYear) });
}

const styles = StyleSheet.create({
  form: { gap: space[2] },
  nonStandardForm: { textDecorationLine: 'line-through' },
  struckForm: { gap: space[2] },
  struck: { alignSelf: 'flex-start' },
  strike: {
    position: 'absolute',
    height: correctionStrike.thickness,
    transform: [{ rotate: correctionStrike.angle }],
  },
  standard: { gap: entryCardFrame.panelGap },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  label: { flexShrink: 1 },
  examplePair: { gap: entryCardFrame.panelGap },
  wrongSentence: { textDecorationLine: 'line-through' },
});
