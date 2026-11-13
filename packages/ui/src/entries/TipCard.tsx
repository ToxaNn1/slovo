import type { ReactNode } from 'react';
import { selfCheckTipCard, withoutStress, type TipCardModel } from '@slovo/core';
import { StyleSheet, View } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { EntryKicker } from './EntryKicker';
import { KickerRow } from './KickerRow';
import { LinkChips } from './LinkChips';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { Wedge } from '../primitives/Wedge';
import { entryCardFrame, space, typeStyle, wedges } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { NonStandardForm, StandardForm } from './CorrectionCard';
import { ExampleText } from './WordCard';
import { capitalised } from './capitalised';
import { SourceLine } from './SourceLine';
import { CardTabs } from './CardTabs';
import { tipTabsOf, type TipTab } from './tip-tabs';

/**
 * The Tip card's blocks inside the Entry card's frame (board XEntry2 e9): the
 * red kicker «ПОРАДА», the title, the rule in a few words, over the red bar,
 * the non-standard form under «Так часто кажуть» when the Tip has one (kept
 * though the board has none, owner 13.11), then the rest. Without tabs the
 * rest is the standard form under «Українською краще», drawn as on a
 * Correction card, the explanation, the Example and the source line. With
 * `tabs` it is the one tab «Правило» (ADR 0091), so no tab bar: the
 * explanation, the standard form and the Example's text in chips, and the
 * source line; with `sourceTab` the sources leave it for a last tab «Джерело»
 * (ADR 0116), and with `exceptionsTab` a Tip with exceptions gets «Винятки»
 * after it, their text and words in chips (ADR 0120). VoiceOver reads the title as «Порада: …», then each form with
 * its label. Under Self-check it keeps the kicker, the title and the
 * non-standard form (ADR 0051); the Entry card draws the button that reveals
 * the rest under them.
 */
export function TipCardBody({
  card,
  lemmaSize,
  concealed,
  corner,
  tabs,
  sourceTab,
  exceptionsTab,
}: {
  card: TipCardModel;
  /** The Lemma's size at the user's font size, a share of which the standard form takes. */
  lemmaSize: TextSize;
  /** Self-check: only the kicker, the title and the non-standard form. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The rest under the title in the tab «Правило», while `wordTabs` is on (ADR 0091). */
  tabs: boolean;
  /** The last tab «Джерело» with the sources, which leave the tab «Правило», while `sourceTab` is on (ADR 0116). */
  sourceTab: boolean;
  /** The tab «Винятки» of a Tip with exceptions, while `tipExceptions` is on (ADR 0120). */
  exceptionsTab: boolean;
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
      <KickerRow testID="tip-kicker-row" corner={corner}>
        <EntryKicker testID="tip-kicker" label={strings.chip} />
      </KickerRow>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={fill(strings.heading, { title: withoutStress(card.title) })}
        {...voice}
        {...turnActions}
        style={styles.header}
      >
        <WholeWordsText
          testID="tip-title"
          text={capitalised(card.title, voice.accessibilityLanguage)}
          typeRole="tipTitle"
          lines={3}
          style={[typeStyle('tipTitle', tokens), { color: colors.ink }]}
        />
        <Wedge
          testID="tip-rule"
          points={wedges.slant}
          color={colors.accent}
          width={entryCardFrame.rule.width}
          height={entryCardFrame.rule.height}
        />
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
          tabs={tipTabsOf(card, { exceptions: exceptionsTab })}
          sources={sourceTab ? card.sourceNames : undefined}
          nameOf={({ key }) => strings.tabs[key]}
          disabled={shown.concealed}
        >
          {(tab) => <TipRule tab={tab} sourceLine={!sourceTab} />}
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

/**
 * A tab of board e9: «Правило», the explanation, the standard form and the
 * Example's text in chips, and the source line unless the sources have
 * their own tab «Джерело»; «Винятки» the same way, its text and its words in
 * chips, with no source line.
 */
function TipRule({ tab, sourceLine }: { tab: TipTab; sourceLine: boolean }) {
  const tokens = useTokens();
  const { voice, strings } = useEdition();
  return (
    <>
      <WholeLinesText
        testID={tab.key === 'rule' ? 'tip-explanation' : 'tip-exceptions'}
        accessibilityLabel={withoutStress(tab.explanation)}
        {...voice}
        style={[typeStyle('tipRule', tokens), { color: tokens.colors.ink }]}
      >
        {capitalised(tab.explanation, voice.accessibilityLanguage)}
      </WholeLinesText>
      <LinkChips
        testID={tab.key === 'rule' ? 'tip-word' : 'tip-exception-word'}
        words={tab.chips}
        byIndex
      />
      {tab.key === 'rule' && sourceLine ? (
        <SourceLine
          testID="tip-source"
          template={strings.correctionCard.source}
          sourceNames={tab.sourceNames}
        />
      ) : null}
    </>
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
  const { voice, strings } = useEdition();
  return (
    <>
      <StandardForm
        testID="tip-standard"
        form={standardForm}
        spoken={withoutStress(standardForm)}
        size={size}
      />
      <WholeLinesText
        testID="tip-explanation"
        accessibilityLabel={withoutStress(explanation)}
        {...voice}
        style={[typeStyle('explanation', tokens), { color: colors.ink }]}
      >
        {capitalised(explanation, voice.accessibilityLanguage)}
      </WholeLinesText>
      <SourceLine
        testID="tip-source"
        template={strings.correctionCard.source}
        sourceNames={sourceNames}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[2] },
});
