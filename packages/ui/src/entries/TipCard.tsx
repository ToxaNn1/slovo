import type { ReactNode } from 'react';
import { selfCheckTipCard, withoutStress, type TipCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { KickerRow } from './KickerRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { useLemmaSize, useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { LabelChip } from '../primitives/LabelChip';
import { space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { NonStandardForm, StandardForm } from './CorrectionCard';
import { ExampleText } from './WordCard';
import { CardTabs } from './CardTabs';
import { tipTabsOf, type TipTab } from './tip-tabs';

/**
 * The Tip card's blocks inside the Entry card's frame: the title, the rule in
 * a few words, with the chip «порада», the non-standard form under «Так часто
 * кажуть» when the Tip has one, the standard form under «Українською краще»,
 * both drawn as on a Correction card, the explanation, the Example and, when
 * the Tip has sources, a line naming them. A Tip with no non-standard form
 * shows only the right way. VoiceOver reads the title as «Порада: …», then
 * each form with its label. Under Self-check it keeps the title, its chip and
 * the non-standard form (ADR 0051); the Entry card draws the button that
 * reveals the rest under them. While `wordTabs` is on, the rest sits in the
 * Entry card's tabs, «Суть» and «Приклад» (ADR 0088).
 */
export function TipCardBody({
  card,
  lemmaSize,
  concealed,
  corner,
  tabs,
}: {
  card: TipCardModel;
  /** The Lemma's size at the user's font size, a share of which the standard form takes. */
  lemmaSize: TextSize;
  /** Self-check: only the title, its chip and the non-standard form. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The rest under the title in tabs, «Суть» and «Приклад», while `wordTabs` is on (ADR 0088). */
  tabs: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.tipCard;
  // In the Feed, VoiceOver turns to the next or previous card from the title.
  const turnActions = usePageTurnActions();
  const shown = selfCheckTipCard({ card, concealed });
  const { nonStandardForm } = shown.card;

  return (
    <>
      <KickerRow testID="tip-kicker-row" corner={corner} />
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={fill(strings.heading, { title: withoutStress(card.title) })}
        {...voice}
        {...turnActions}
        style={styles.header}
      >
        <Text testID="tip-title" style={[typeStyle('tipTitle', tokens), { color: colors.ink }]}>
          {card.title}
        </Text>
        <View style={styles.chip}>
          <LabelChip
            testID="tip-chip"
            text={strings.chip}
            accessibilityLabel={strings.chip}
            size="tight"
          />
        </View>
      </View>
      {nonStandardForm === undefined ? null : (
        <NonStandardForm
          testID="tip-non-standard"
          form={nonStandardForm}
          spoken={withoutStress(nonStandardForm)}
        />
      )}
      {tabs ? (
        <CardTabs
          testID="tip"
          tabs={tipTabsOf(card)}
          nameOf={({ key }) => edition.strings.wordCard.tabs[key]}
          disabled={shown.concealed}
        >
          {(tab) => <TipTabContent tab={tab} />}
        </CardTabs>
      ) : shown.concealed ? null : (
        <>
          <TipEssence
            standardForm={shown.card.standardForm}
            explanation={shown.card.explanation}
            sourceNames={shown.card.sourceNames}
            size={lemmaSize}
          />
          {shown.card.example === undefined ? null : (
            <ExampleText testID="tip-example" example={shown.card.example} size={sizes.example} />
          )}
        </>
      )}
    </>
  );
}

/** What the selected tab of a Tip shows, at the font size its frame gives (ADR 0088). */
function TipTabContent({ tab }: { tab: TipTab }) {
  const sizes = useWordTextSizes();
  const lemmaSize = useLemmaSize();
  return tab.key === 'essence' ? (
    <TipEssence
      standardForm={tab.standardForm}
      explanation={tab.explanation}
      sourceNames={tab.sourceNames}
      size={lemmaSize}
    />
  ) : (
    // The Example is the tab's large quote, as on a Word's «Приклад».
    <ExampleText testID="tip-example" example={tab.example} size={sizes.definition} />
  );
}

/**
 * The standard form, a phrase at a share of the Lemma's size (board С2.6), the
 * explanation and the line naming the sources.
 */
function TipEssence({
  standardForm,
  explanation,
  sourceNames,
  size,
}: {
  standardForm: string;
  explanation: string;
  sourceNames: readonly string[];
  size: TextSize;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const edition = useEdition();
  const { voice } = edition;
  return (
    <>
      <StandardForm
        testID="tip-standard"
        form={standardForm}
        spoken={withoutStress(standardForm)}
        size={size}
      />
      <Text
        testID="tip-explanation"
        accessibilityLabel={withoutStress(explanation)}
        {...voice}
        style={[typeStyle('explanation', tokens), { color: colors.ink }]}
      >
        {explanation}
      </Text>
      {sourceNames.length === 0 ? null : (
        <Text
          testID="tip-source"
          {...voice}
          style={[typeStyle('meta', tokens), { color: colors.muted }]}
        >
          {fill(edition.strings.correctionCard.source, {
            source: sourceNames.join(SOURCE_SEPARATOR),
          })}
        </Text>
      )}
    </>
  );
}

/** What sits between the titles of a Tip's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: { gap: space[2] },
  chip: { flexDirection: 'row' },
});
