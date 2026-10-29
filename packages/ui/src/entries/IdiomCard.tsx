import { withoutStress, type IdiomCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { OrnamentDivider } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { OutlinedChip } from '../primitives/OutlinedChip';
import { space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { DetailSection, ExampleText } from './WordCard';

/**
 * The Idiom card's blocks inside the Entry card's frame: the expression at
 * the Lemma's size with the chip of its Idiom Type («фразеологізм» or
 * «топонім»), the primary Definition and the others, the Examples,
 * «Походження» and, when the Idiom has sources, a line naming them. It draws
 * only the sections the Core put in the card. VoiceOver reads the expression
 * with its kind, then its Definition. Under Self-check it keeps the
 * expression and its chip; the Entry card draws the button that reveals the
 * rest under them.
 */
export function IdiomCardBody({
  card,
  lemmaSize,
  concealed,
}: {
  card: IdiomCardModel;
  /** The Lemma's size at the user's font size, which the expression takes. */
  lemmaSize: TextSize;
  /** Self-check: only the expression and its chip. */
  concealed: boolean;
}) {
  const { colors, fontFamilies } = useTokens();
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.idiomCard;
  // In the Feed, VoiceOver turns to the next or previous card from the expression and the Definition.
  const turnActions = usePageTurnActions();
  const idiomType = strings.idiomTypes[card.idiomType];
  const bodyText = [sizes.example, { color: colors.ink, fontFamily: fontFamilies.word }];

  return (
    <>
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={fill(strings.heading, {
          expression: withoutStress(card.expression),
          type: idiomType,
        })}
        {...voice}
        {...turnActions}
        style={styles.header}
      >
        <WholeWordsText
          text={card.expression}
          size={lemmaSize}
          tracking={-0.01}
          testID="idiom-expression"
          // An expression wraps between its words and shrinks rather than break inside one.
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[styles.expression, { color: colors.ink, fontFamily: fontFamilies.word }]}
        />
        <View style={styles.chip}>
          <OutlinedChip
            testID="idiom-type"
            text={idiomType}
            accessibilityLabel={idiomType}
            size="tight"
          />
        </View>
      </View>
      <View>
        {/* Decor slot 2, between the header and the Definition. */}
        <OrnamentDivider />
      </View>
      {concealed ? null : (
        <>
          <Text
            testID="idiom-definition"
            // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
            accessibilityLabel={withoutStress(card.primaryDefinition)}
            {...voice}
            {...turnActions}
            style={[sizes.definition, { color: colors.ink, fontFamily: fontFamilies.word }]}
          >
            {card.primaryDefinition}
          </Text>
          {card.extraDefinitions.length === 0 ? null : (
            <DetailSection
              testID="idiom-extra-definitions"
              title={edition.strings.wordCard.extraDefinitions}
            >
              {card.extraDefinitions.map((definition, index) => (
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
          {card.examples.map((example, index) => (
            <ExampleText
              key={index}
              testID="idiom-example"
              example={example}
              size={sizes.example}
            />
          ))}
          {card.etymology === undefined ? null : (
            <DetailSection testID="idiom-etymology" title={strings.etymology}>
              <Text
                accessibilityLabel={withoutStress(card.etymology)}
                {...voice}
                style={[
                  styles.etymology,
                  { color: colors.inkSecondary, fontFamily: fontFamilies.ui },
                ]}
              >
                {card.etymology}
              </Text>
            </DetailSection>
          )}
          {card.sourceNames.length === 0 ? null : (
            <Text
              testID="idiom-source"
              {...voice}
              style={[styles.source, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {fill(strings.source, { source: card.sourceNames.join(SOURCE_SEPARATOR) })}
            </Text>
          )}
        </>
      )}
    </>
  );
}

/** What sits between the titles of an Idiom's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: { gap: space[2] },
  expression: { fontWeight: '500' },
  chip: { flexDirection: 'row' },
  etymology: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  source: { fontSize: typeSize.meta, lineHeight: typeSize.meta * 1.4 },
});
