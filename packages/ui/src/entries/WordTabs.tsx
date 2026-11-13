import { withoutStress, type WordCardModel } from '@slovo/core';
import { StyleSheet, View } from 'react-native';

import { WholeLinesText } from '../primitives/WholeLines';
import { useEdition } from '../providers/EditionProvider';
import { useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { exampleMark, space, typeStyle } from '../tokens';
import { capitalised } from './capitalised';
import { NumberedDefinitions } from './NumberedDefinitions';
import { CardTabs } from './CardTabs';
import { LinkChips } from './LinkChips';
import { ExampleMark } from './ExampleMark';
import {
  DetailSection,
  ExampleText,
  OftenSaid,
  SynonymRowLine,
  WordDefinition,
  WordHistory,
  WordIllustration,
} from './WordCard';
import { wordTabsOf, type WordTab } from './word-tabs';

/**
 * The Word card's tabs under its Lemma (ADR 0091): «Суть», «Приклад»,
 * «Зв’язки» and «Історія», without the empty ones, «Суть» selected first, in
 * the Entry card's tabs (`CardTabs`), and while `sourceTab` is on «Джерело»
 * last (ADR 0116).
 */
export function WordTabs({
  card,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
  sources,
  disabled = false,
}: {
  card: WordCardModel;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  onHistoryShown: (() => void) | undefined;
  /** The names of the Word's sources for the «Джерело» tab, only while `sourceTab` is on (ADR 0116). */
  sources: readonly string[] | undefined;
  /** Self-check conceals the card: the tabs are there but disabled until the reveal. */
  disabled?: boolean;
}) {
  const { strings } = useEdition();
  return (
    <CardTabs
      testID="word"
      tabs={wordTabsOf(card)}
      nameOf={({ key }) => strings.wordCard.tabs[key]}
      sources={sources}
      disabled={disabled}
    >
      {(tab) => (
        <TabContent
          tab={tab}
          card={card}
          onOpenCorrection={onOpenCorrection}
          onOpenSynonymRow={onOpenSynonymRow}
          onHistoryShown={onHistoryShown}
        />
      )}
    </CardTabs>
  );
}

/** What the selected tab shows. */
function TabContent({
  tab,
  card,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
}: {
  tab: WordTab;
  card: WordCardModel;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  onHistoryShown: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings: editionStrings, voice, count } = useEdition();
  const strings = editionStrings.wordCard;
  const sizes = useWordTextSizes();
  const body = [typeStyle('sectionText', tokens), { color: colors.ink }];
  switch (tab.key) {
    case 'essence':
      return (
        <>
          <WordIllustration card={card} />
          <WordDefinition card={card} />
          {tab.moreMeanings === 0 ? null : (
            <WholeLinesText
              testID="word-more-meanings"
              {...voice}
              style={[typeStyle('sub', tokens), { color: colors.muted }]}
            >
              {capitalised(
                count(strings.moreMeanings, tab.moreMeanings),
                voice.accessibilityLanguage,
              )}
            </WholeLinesText>
          )}
          {card.synonymRow === undefined ? null : (
            <SynonymRowLine synonymRow={card.synonymRow} onOpen={onOpenSynonymRow} />
          )}
          <OftenSaid card={card} onOpenCorrection={onOpenCorrection} />
        </>
      );
    case 'example': {
      const [first, ...rest] = tab.examples;
      return (
        <>
          <View style={styles.quote}>
            <ExampleMark testID="word-example-mark" />
            {/* The first Example is the tab's large quote. */}
            <ExampleText
              testID="word-example"
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
    case 'links':
      return (
        <>
          {[
            { key: 'synonyms', words: tab.synonyms, ...strings.linkLabels.synonyms },
            { key: 'antonyms', words: tab.antonyms, ...strings.linkLabels.antonyms },
          ]
            .filter(({ words }) => words.length > 0)
            .map(({ key, words, one, many }) => (
              <View key={key} testID={`word-${key}`} style={styles.links}>
                <WholeLinesText
                  style={[typeStyle('linksLabel', tokens), { color: colors.muted }]}
                  {...voice}
                >
                  {words.length === 1 ? one : many}
                </WholeLinesText>
                <LinkChips testID={`word-${key}`} words={words} />
              </View>
            ))}
        </>
      );
    case 'history':
      return (
        <>
          {tab.meanings.length === 0 ? null : (
            <DetailSection testID="word-meanings" title={strings.extraDefinitions}>
              <NumberedDefinitions definitions={tab.meanings} style={body} />
            </DetailSection>
          )}
          {tab.etymology.length === 0 ? null : (
            <DetailSection testID="word-etymology" title={strings.etymology}>
              {/* A paragraph per group of the dictionary's etymology, apart, so it reads as steps. */}
              <View style={styles.paragraphs}>
                {tab.etymology.map((paragraph, index) => (
                  <WholeLinesText
                    key={index}
                    accessibilityLabel={withoutStress(paragraph)}
                    {...voice}
                    style={body}
                  >
                    {capitalised(paragraph, voice.accessibilityLanguage)}
                  </WholeLinesText>
                ))}
              </View>
            </DetailSection>
          )}
          {tab.history === undefined ? null : (
            <WordHistory history={tab.history} onShown={onHistoryShown} />
          )}
        </>
      );
  }
}

const styles = StyleSheet.create({
  quote: { gap: exampleMark.gap },
  paragraphs: { gap: space[2] },
  links: { gap: space[2] },
});
