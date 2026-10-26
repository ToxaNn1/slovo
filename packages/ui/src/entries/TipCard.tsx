import { selfCheckTipCard, withoutStress, type TipCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { OrnamentDivider } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { OutlinedChip } from '../primitives/OutlinedChip';
import { space, typeSize } from '../tokens';
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
}: {
  card: TipCardModel;
  /** The Lemma's size at the user's font size, which the standard form takes. */
  lemmaSize: TextSize;
  /** Self-check: only the title, its chip and the non-standard form. */
  concealed: boolean;
}) {
  const { colors, fontFamilies } = useTokens();
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
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={fill(strings.heading, { title: withoutStress(card.title) })}
        {...voice}
        {...turnActions}
        style={styles.header}
      >
        <Text
          testID="tip-title"
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {card.title}
        </Text>
        <View style={styles.chip}>
          <OutlinedChip
            testID="tip-chip"
            text={strings.chip}
            accessibilityLabel={strings.chip}
            size="tight"
          />
        </View>
      </View>
      <View>
        {/* Decor slot 2, between the header and the forms. */}
        <OrnamentDivider />
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
            style={[styles.explanation, { color: colors.ink, fontFamily: fontFamilies.ui }]}
          >
            {shown.card.explanation}
          </Text>
          {shown.card.example === undefined ? null : (
            <ExampleText testID="tip-example" example={shown.card.example} size={sizes.example} />
          )}
          {shown.card.sourceTitles.length === 0 ? null : (
            <Text
              testID="tip-source"
              {...voice}
              style={[styles.source, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {fill(edition.strings.correctionCard.source, {
                source: shown.card.sourceTitles.join(SOURCE_SEPARATOR),
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
  title: {
    fontSize: typeSize.sheetTitle,
    lineHeight: typeSize.sheetTitle * 1.2,
    fontWeight: '500',
  },
  chip: { flexDirection: 'row' },
  explanation: { fontSize: typeSize.explanation, lineHeight: typeSize.explanation * 1.55 },
  source: { fontSize: typeSize.meta, lineHeight: typeSize.meta * 1.4 },
});
