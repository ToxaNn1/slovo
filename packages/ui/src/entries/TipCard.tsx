import type { ReactNode } from 'react';
import { selfCheckTipCard, withoutStress, type TipCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { KickerRow } from './KickerRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { LabelChip } from '../primitives/LabelChip';
import { space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { NonStandardForm, StandardForm } from './CorrectionCard';
import { ExampleText } from './WordCard';

/**
 * The Tip card's blocks inside the Entry card's frame: the title, the rule in
 * a few words, with the chip «порада», the non-standard form under «Так часто
 * кажуть» when the Tip has one, the standard form under «Українською краще»,
 * both drawn as on a Correction card, the explanation, the Example and, when
 * the Tip has sources, a line naming them. A Tip with no non-standard form
 * shows only the right way. VoiceOver reads the title as «Порада: …», then
 * each form with its label. Under Self-check it keeps the title, its chip and
 * the non-standard form (ADR 0051); the Entry card draws the button that
 * reveals the rest under them.
 */
export function TipCardBody({
  card,
  lemmaSize,
  concealed,
  corner,
}: {
  card: TipCardModel;
  /** The Lemma's size at the user's font size, which the standard form takes. */
  lemmaSize: TextSize;
  /** Self-check: only the title, its chip and the non-standard form. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
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
      {shown.concealed ? null : (
        <>
          <StandardForm
            testID="tip-standard"
            form={shown.card.standardForm}
            spoken={withoutStress(shown.card.standardForm)}
            size={lemmaSize}
          />
          <Text
            testID="tip-explanation"
            accessibilityLabel={withoutStress(shown.card.explanation)}
            {...voice}
            style={[typeStyle('explanation', tokens), { color: colors.ink }]}
          >
            {shown.card.explanation}
          </Text>
          {shown.card.example === undefined ? null : (
            <ExampleText testID="tip-example" example={shown.card.example} size={sizes.example} />
          )}
          {shown.card.sourceNames.length === 0 ? null : (
            <Text
              testID="tip-source"
              {...voice}
              style={[typeStyle('meta', tokens), { color: colors.muted }]}
            >
              {fill(edition.strings.correctionCard.source, {
                source: shown.card.sourceNames.join(SOURCE_SEPARATOR),
              })}
            </Text>
          )}
        </>
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
