import type { ReactNode } from 'react';
import { withoutStress, type IdiomCardModel } from '@slovo/core';
import { StyleSheet, View } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { EntryKicker } from './EntryKicker';
import { KickerRow } from './KickerRow';
import { fill, useEdition } from '../providers/EditionProvider';
import { useWordTextSizes, type TextSize } from '../providers/FontSizeProvider';
import { Wedge } from '../primitives/Wedge';
import {
  entryCardFrame,
  exampleMark,
  roleAt,
  titleSize,
  space,
  typeRoles,
  typeStyle,
  wedges,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { capitalised } from './capitalised';
import { SourceLine } from './SourceLine';
import { NumberedDefinitions } from './NumberedDefinitions';
import { CardTabs } from './CardTabs';
import { ExampleMark } from './ExampleMark';
import { useFlyingText } from './reveal';
import { ExampleText } from './WordCard';
import { idiomTabsOf, type IdiomTab } from './word-tabs';
import { useCardFeatures } from './card-features';

/**
 * The Idiom card's blocks inside the Entry card's frame: the red kicker of
 * its Idiom Type («ФРАЗЕОЛОГІЗМ» or «ТОПОНІМ»), the expression at the
 * Lemma's size over the red bar (board XEntry2 e7), the primary Definition and the others, the Examples,
 * «Походження» and, when the Idiom has sources, a line naming them. It draws
 * only the sections the Core put in the card. VoiceOver reads the expression
 * with its kind, then its Definition. Under Self-check it keeps the
 * kicker and the expression; the Entry card draws the button that reveals the
 * rest under them. The rest sits in the tabs «Суть», «Звідки» and «Приклад».
 */
export function IdiomCardBody({
  card,
  lemmaSize,
  concealed,
  corner,
  headless = false,
}: {
  card: IdiomCardModel;
  /** The Lemma's size at the user's font size, which the expression takes. */
  lemmaSize: TextSize;
  /** Self-check: only the kicker and the expression. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The kicker and the headline are drawn in Entry details' red panel, so the body leaves them out. */
  headless?: boolean;
}) {
  const { sourceTab } = useCardFeatures();
  const tokens = useTokens();
  const { colors } = tokens;
  const edition = useEdition();
  const { voice } = edition;
  const strings = edition.strings.idiomCard;
  // In the Feed, VoiceOver turns to the next or previous card from the expression and the Definition.
  const turnActions = usePageTurnActions();
  // The headline's letters fly in as the card reveals.
  const flying = useFlyingText();
  const idiomType = strings.idiomTypes[card.idiomType];
  // The expression starts at its step of the cards' one title scale.
  const expressionSize = titleSize('idiomExpression', lemmaSize);

  return (
    <>
      {headless ? null : (
        <>
          <KickerRow testID="idiom-kicker-row" corner={corner}>
            <EntryKicker testID="idiom-type" label={idiomType} />
          </KickerRow>
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
              text={capitalised(card.expression, voice.accessibilityLanguage)}
              size={expressionSize}
              typeRole="idiomExpression"
              testID="idiom-expression"
              stepped
              // A title of 36 or more keeps its size at every OS text size.
              allowFontScaling={false}
              lines={3}
              style={[typeStyle('idiomExpression', tokens), { color: colors.ink }]}
            />
            <Wedge
              testID="idiom-rule"
              points={wedges.slant}
              color={colors.accent}
              width={entryCardFrame.rule.width}
              height={entryCardFrame.rule.height}
            />
          </View>
        </>
      )}
      <CardTabs
        testID="idiom"
        tabs={idiomTabsOf(card)}
        nameOf={({ key }) => strings.tabs[key]}
        sources={sourceTab ? card.sourceNames : undefined}
        disabled={concealed}
      >
        {(tab) => <IdiomTabContent tab={tab} sourceTab={sourceTab} />}
      </CardTabs>
    </>
  );
}

/** What the selected tab of an Idiom card shows. */
function IdiomTabContent({ tab, sourceTab }: { tab: IdiomTab; sourceTab: boolean }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const { voice, strings: editionStrings } = useEdition();
  // In the Feed, VoiceOver turns to the next or previous card from the Definition too.
  const turnActions = usePageTurnActions();
  const body = [typeStyle('sectionText', tokens), { color: colors.ink }];
  switch (tab.key) {
    case 'essence':
      return (
        <>
          <WholeLinesText
            testID="idiom-definition"
            accessibilityLabel={withoutStress(tab.definition)}
            {...voice}
            {...turnActions}
            style={[
              typeStyle('idiomEssence', tokens),
              // «Суть» is larger than a Definition, and grows with it at the user's font size.
              roleAt(
                'idiomEssence',
                (sizes.definition.fontSize * typeRoles.idiomEssence.size) /
                  typeRoles.definition.size,
              ),
              { color: colors.ink },
            ]}
          >
            {capitalised(tab.definition, voice.accessibilityLanguage)}
          </WholeLinesText>
          <NumberedDefinitions definitions={tab.meanings} style={body} />
          {sourceTab ? null : (
            <SourceLine
              testID="idiom-source"
              template={editionStrings.idiomCard.source}
              sourceNames={tab.sourceNames}
            />
          )}
        </>
      );
    case 'origin':
      return (
        <WholeLinesText
          testID="idiom-etymology"
          accessibilityLabel={withoutStress(tab.etymology)}
          {...voice}
          style={[typeStyle('idiomEtymology', tokens), { color: colors.ink }]}
        >
          {capitalised(tab.etymology, voice.accessibilityLanguage)}
        </WholeLinesText>
      );
    case 'example': {
      const [first, ...rest] = tab.examples;
      return (
        <>
          <View style={styles.quote}>
            <ExampleMark testID="idiom-example-mark" edge="open" />
            {/* The first Example is the tab's large quote, closed by a mark like the one over it (owner 14.11). */}
            <ExampleText
              testID="idiom-example"
              example={first}
              size={sizes.definition}
              quoted={false}
            />
            <ExampleMark testID="idiom-example-close-mark" edge="close" />
          </View>
          {rest.map((example, index) => (
            <ExampleText key={index} example={example} size={sizes.example} quoted={false} />
          ))}
        </>
      );
    }
  }
}

const styles = StyleSheet.create({
  header: { gap: space[2] },
  quote: { gap: exampleMark.gap },
});
