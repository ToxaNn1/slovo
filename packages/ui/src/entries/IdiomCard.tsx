import type { ReactNode } from 'react';
import { withoutStress, type IdiomCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { KickerRow } from './KickerRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { LabelChip } from '../primitives/LabelChip';
import { space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { CardTabs } from './CardTabs';
import { useFlyingText } from './reveal';
import { DetailSection, ExampleText } from './WordCard';
import { idiomTabsOf, type IdiomTab } from './word-tabs';

/**
 * The Idiom card's blocks inside the Entry card's frame: the expression at
 * the Lemma's size with the chip of its Idiom Type («фразеологізм» or
 * «топонім»), the primary Definition and the others, the Examples,
 * «Походження» and, when the Idiom has sources, a line naming them. It draws
 * only the sections the Core put in the card. VoiceOver reads the expression
 * with its kind, then its Definition. Under Self-check it keeps the
 * expression and its chip; the Entry card draws the button that reveals the
 * rest under them. With `tabs` the expression is underlined in the accent and
 * the rest sits in the tabs «Суть», «Звідки» and «Приклад» (ADR 0088).
 */
export function IdiomCardBody({
  card,
  lemmaSize,
  concealed,
  corner,
  tabs,
}: {
  card: IdiomCardModel;
  /** The Lemma's size at the user's font size, which the expression takes. */
  lemmaSize: TextSize;
  /** Self-check: only the expression and its chip. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The tabs under the expression in place of the one column, while `wordTabs` is on (ADR 0088). */
  tabs: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.idiomCard;
  // In the Feed, VoiceOver turns to the next or previous card from the expression and the Definition.
  const turnActions = usePageTurnActions();
  // The headline's letters fly in as the card reveals.
  const flying = useFlyingText();
  const idiomType = strings.idiomTypes[card.idiomType];
  const bodyText = [typeStyle('example', tokens), sizes.example, { color: colors.ink }];

  return (
    <>
      <KickerRow testID="idiom-kicker-row" corner={corner} />
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
          flying={flying}
          text={card.expression}
          size={lemmaSize}
          typeRole="heroWord"
          testID="idiom-expression"
          // An expression wraps between its words and shrinks rather than break inside one.
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[
            typeStyle('heroWord', tokens),
            { color: colors.ink },
            // The tabbed card underlines the expression in red, as the board draws it.
            tabs && [styles.underline, { textDecorationColor: colors.accent }],
          ]}
        />
        <View style={styles.chip}>
          <LabelChip
            testID="idiom-type"
            text={idiomType}
            accessibilityLabel={idiomType}
            size="tight"
          />
        </View>
      </View>
      {tabs ? (
        <CardTabs
          testID="idiom"
          tabs={idiomTabsOf(card)}
          nameOf={({ key }) => strings.tabs[key]}
          disabled={concealed}
        >
          {(tab) => <IdiomTabContent tab={tab} />}
        </CardTabs>
      ) : concealed ? null : (
        <>
          <Text
            testID="idiom-definition"
            // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
            accessibilityLabel={withoutStress(card.primaryDefinition)}
            {...voice}
            {...turnActions}
            style={[typeStyle('definition', tokens), sizes.definition, { color: colors.ink }]}
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
                style={[typeStyle('idiomEtymology', tokens), { color: colors.ink }]}
              >
                {card.etymology}
              </Text>
            </DetailSection>
          )}
          <IdiomSources sourceNames={card.sourceNames} />
        </>
      )}
    </>
  );
}

/** What the selected tab of an Idiom card shows (ADR 0088). */
function IdiomTabContent({ tab }: { tab: IdiomTab }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const { voice } = useEdition();
  const body = [typeStyle('sectionText', tokens), { color: colors.ink }];
  switch (tab.key) {
    case 'essence':
      return (
        <>
          <Text
            testID="idiom-definition"
            accessibilityLabel={withoutStress(tab.definition)}
            {...voice}
            style={[typeStyle('definition', tokens), sizes.definition, { color: colors.ink }]}
          >
            {tab.definition}
          </Text>
          {tab.meanings.map((meaning, index) => (
            <Text
              key={index}
              accessibilityLabel={withoutStress(`${String(index + 2)}. ${meaning}`)}
              {...voice}
              style={body}
            >
              {/* The primary Definition is the first; these number on from 2. */}
              {`${String(index + 2)}. ${meaning}`}
            </Text>
          ))}
          <IdiomSources sourceNames={tab.sourceNames} />
        </>
      );
    case 'origin':
      return (
        <Text
          testID="idiom-etymology"
          accessibilityLabel={withoutStress(tab.etymology)}
          {...voice}
          style={[typeStyle('idiomEtymology', tokens), { color: colors.ink }]}
        >
          {tab.etymology}
        </Text>
      );
    case 'example': {
      const [first, ...rest] = tab.examples;
      return (
        <>
          {/* The first Example is the tab's large quote. */}
          <ExampleText testID="idiom-example" example={first} size={sizes.definition} />
          {rest.map((example, index) => (
            <ExampleText key={index} example={example} size={sizes.example} />
          ))}
        </>
      );
    }
  }
}

/** The line naming an Idiom's sources, when it has any. */
function IdiomSources({ sourceNames }: { sourceNames: readonly string[] }) {
  const tokens = useTokens();
  const edition = useEdition();
  if (sourceNames.length === 0) return null;
  return (
    <Text
      testID="idiom-source"
      {...edition.voice}
      style={[typeStyle('meta', tokens), { color: tokens.colors.muted }]}
    >
      {fill(edition.strings.idiomCard.source, { source: sourceNames.join(SOURCE_SEPARATOR) })}
    </Text>
  );
}

/** What sits between the titles of an Idiom's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: { gap: space[2] },
  chip: { flexDirection: 'row' },
  underline: { textDecorationLine: 'underline' },
});
