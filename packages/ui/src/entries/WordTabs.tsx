import { withoutStress, type WordCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { LabelChip } from '../primitives/LabelChip';
import { space, typeStyle } from '../tokens';
import { CategoryChip } from './CategoryChip';
import { EntryTabs } from './EntryTabs';
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
 * The Word card's tabs under its Lemma (ADR 0088): «Суть», «Приклад»,
 * «Зв’язки» and «Історія», without the empty ones, in the Entry card's tab
 * frame (`EntryTabs`).
 */
export function WordTabs({
  card,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
}: {
  card: WordCardModel;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  onHistoryShown: (() => void) | undefined;
}) {
  const { strings } = useEdition();
  return (
    <EntryTabs tabs={wordTabsOf(card)} names={strings.wordCard.tabs} testID="word">
      {(tab) => (
        <TabContent
          tab={tab}
          card={card}
          onOpenCorrection={onOpenCorrection}
          onOpenSynonymRow={onOpenSynonymRow}
          onHistoryShown={onHistoryShown}
        />
      )}
    </EntryTabs>
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
            <Text
              testID="word-more-meanings"
              {...voice}
              style={[typeStyle('sub', tokens), { color: colors.muted }]}
            >
              {count(strings.moreMeanings, tab.moreMeanings)}
            </Text>
          )}
          {card.categoryName === undefined ? null : (
            <CategoryChip testID="word-category" name={card.categoryName} />
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
          {/* The first Example is the tab's large quote. */}
          <ExampleText testID="word-example" example={first} size={sizes.definition} />
          {rest.map((example, index) => (
            <ExampleText key={index} example={example} size={sizes.example} />
          ))}
        </>
      );
    }
    case 'links':
      return (
        <>
          {[
            { key: 'synonyms', words: tab.synonyms, one: strings.synonym, many: strings.synonyms },
            { key: 'antonyms', words: tab.antonyms, one: strings.antonym, many: strings.antonyms },
          ]
            .filter(({ words }) => words.length > 0)
            .map(({ key, words, one, many }) => (
              <View key={key} testID={`word-${key}`} style={styles.links}>
                <Text style={[typeStyle('sub', tokens), { color: colors.muted }]} {...voice}>
                  {words.length === 1 ? one : many}
                </Text>
                <View style={styles.chips}>
                  {words.map((word) => (
                    <LabelChip
                      key={word}
                      testID={`word-${key}-${word}`}
                      text={word}
                      accessibilityLabel={withoutStress(word)}
                      size="roomy"
                    />
                  ))}
                </View>
              </View>
            ))}
        </>
      );
    case 'history':
      return (
        <>
          {tab.meanings.length === 0 ? null : (
            <DetailSection testID="word-meanings" title={strings.extraDefinitions}>
              {tab.meanings.map((meaning, index) => (
                <Text
                  key={index}
                  accessibilityLabel={withoutStress(`${String(index + 1)}. ${meaning}`)}
                  {...voice}
                  style={body}
                >
                  {`${String(index + 1)}. ${meaning}`}
                </Text>
              ))}
            </DetailSection>
          )}
          {tab.etymology === undefined ? null : (
            <DetailSection testID="word-etymology" title={strings.etymology}>
              <Text accessibilityLabel={withoutStress(tab.etymology)} {...voice} style={body}>
                {tab.etymology}
              </Text>
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
  links: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
