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
  idiomExpressionLength,
  roleAt,
  sizeForLength,
  space,
  typeRoles,
  typeStyle,
  wedges,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { capitalised } from './capitalised';
import { NumberedDefinitions } from './NumberedDefinitions';
import { CardTabs } from './CardTabs';
import { ExampleMark } from './ExampleMark';
import { useFlyingText } from './reveal';
import { DetailSection, ExampleText } from './WordCard';
import { idiomTabsOf, type IdiomTab } from './word-tabs';

/**
 * The Idiom card's blocks inside the Entry card's frame: the red kicker of
 * its Idiom Type («ФРАЗЕОЛОГІЗМ» or «ТОПОНІМ»), the expression at the
 * Lemma's size over the red bar (board XEntry2 e7), the primary Definition and the others, the Examples,
 * «Походження» and, when the Idiom has sources, a line naming them. It draws
 * only the sections the Core put in the card. VoiceOver reads the expression
 * with its kind, then its Definition. Under Self-check it keeps the
 * kicker and the expression; the Entry card draws the button that reveals the
 * rest under them. With `tabs` the rest sits in the tabs «Суть», «Звідки» and «Приклад» (ADR 0091).
 */
export function IdiomCardBody({
  card,
  lemmaSize,
  concealed,
  corner,
  tabs,
  sourceTab,
}: {
  card: IdiomCardModel;
  /** The Lemma's size at the user's font size, which the expression takes. */
  lemmaSize: TextSize;
  /** Self-check: only the kicker and the expression. */
  concealed: boolean;
  /** The corner actions, set in one row beside the card's kicker (`KickerRow`). */
  corner: ReactNode | undefined;
  /** The tabs under the expression in place of the one column, while `wordTabs` is on (ADR 0091). */
  tabs: boolean;
  /** The last tab «Джерело» with the sources, which leave «Суть», while `sourceTab` is on (ADR 0116). */
  sourceTab: boolean;
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
  // A long expression takes a smaller size, the cards' one text scale (owner 08.11).
  const { fontSize } = sizeForLength(lemmaSize, card.expression, idiomExpressionLength);
  const { lineHeight } = roleAt('idiomExpression', fontSize);

  return (
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
          size={{ fontSize, lineHeight }}
          typeRole="idiomExpression"
          testID="idiom-expression"
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
      {tabs ? (
        <CardTabs
          testID="idiom"
          tabs={idiomTabsOf(card)}
          nameOf={({ key }) => strings.tabs[key]}
          sources={sourceTab ? card.sourceNames : undefined}
          disabled={concealed}
        >
          {(tab) => <IdiomTabContent tab={tab} sourceTab={sourceTab} />}
        </CardTabs>
      ) : concealed ? null : (
        <>
          <WholeLinesText
            testID="idiom-definition"
            // The voices break a word at its Stress mark, so VoiceOver reads the text without it.
            accessibilityLabel={withoutStress(card.primaryDefinition)}
            {...voice}
            {...turnActions}
            style={[typeStyle('definition', tokens), sizes.definition, { color: colors.ink }]}
          >
            {capitalised(card.primaryDefinition, voice.accessibilityLanguage)}
          </WholeLinesText>
          {card.extraDefinitions.length === 0 ? null : (
            <DetailSection
              testID="idiom-extra-definitions"
              title={edition.strings.wordCard.extraDefinitions}
            >
              <NumberedDefinitions definitions={card.extraDefinitions} style={bodyText} />
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
              <WholeLinesText
                accessibilityLabel={withoutStress(card.etymology)}
                {...voice}
                style={[typeStyle('idiomEtymology', tokens), { color: colors.ink }]}
              >
                {capitalised(card.etymology, voice.accessibilityLanguage)}
              </WholeLinesText>
            </DetailSection>
          )}
          <IdiomSources sourceNames={card.sourceNames} />
        </>
      )}
    </>
  );
}

/** What the selected tab of an Idiom card shows (ADR 0091). */
function IdiomTabContent({ tab, sourceTab }: { tab: IdiomTab; sourceTab: boolean }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const sizes = useWordTextSizes();
  const { voice } = useEdition();
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
          {sourceTab ? null : <IdiomSources sourceNames={tab.sourceNames} />}
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
            <ExampleMark testID="idiom-example-mark" />
            {/* The first Example is the tab's large quote. */}
            <ExampleText
              testID="idiom-example"
              example={first}
              size={sizes.definition}
              quoted={false}
            />
          </View>
          {rest.map((example, index) => (
            <ExampleText key={index} example={example} size={sizes.example} quoted={false} />
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
    <WholeLinesText
      testID="idiom-source"
      {...edition.voice}
      style={[typeStyle('meta', tokens), { color: tokens.colors.muted }]}
    >
      {fill(edition.strings.idiomCard.source, { source: sourceNames.join(SOURCE_SEPARATOR) })}
    </WholeLinesText>
  );
}

/** What sits between the titles of an Idiom's sources on the source line. */
const SOURCE_SEPARATOR = '; ';

const styles = StyleSheet.create({
  header: { gap: space[2] },
  quote: { gap: exampleMark.gap },
});
