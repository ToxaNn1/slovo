import { withoutStress, type WordCardModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { exampleMark, linkChip, space, typeStyle } from '../tokens';
import { CardTabs } from './CardTabs';
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
 * the Entry card's tabs (`CardTabs`).
 */
export function WordTabs({
  card,
  onOpenCorrection,
  onOpenSynonymRow,
  onHistoryShown,
  disabled = false,
}: {
  card: WordCardModel;
  onOpenCorrection: ((correctionId: string) => void) | undefined;
  onOpenSynonymRow: ((synonymRowId: string) => void) | undefined;
  onHistoryShown: (() => void) | undefined;
  /** Self-check conceals the card: the tabs are there but disabled until the reveal. */
  disabled?: boolean;
}) {
  const { strings } = useEdition();
  return (
    <CardTabs
      testID="word"
      tabs={wordTabsOf(card)}
      nameOf={({ key }) => strings.wordCard.tabs[key]}
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
            <Text
              testID="word-more-meanings"
              {...voice}
              style={[typeStyle('sub', tokens), { color: colors.muted }]}
            >
              {count(strings.moreMeanings, tab.moreMeanings)}
            </Text>
          )}
          {card.synonymRow === undefined ? null : (
            <SynonymRowLine synonymRow={card.synonymRow} onOpen={onOpenSynonymRow} />
          )}
          <OftenSaid card={card} onOpenCorrection={onOpenCorrection} />
        </>
      );
    case 'example': {
      const [first, ...rest] = tab.examples;
      // The big red mark is the opening one of the Edition's quote around an Example.
      const [mark = ''] = strings.example.split('{text}');
      return (
        <>
          <View style={styles.quote}>
            {mark === '' ? null : (
              <Text
                testID="word-example-mark"
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[typeStyle('exampleMark', tokens), { color: colors.accent }]}
              >
                {mark}
              </Text>
            )}
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
                <Text style={[typeStyle('linksLabel', tokens), { color: colors.muted }]} {...voice}>
                  {words.length === 1 ? one : many}
                </Text>
                <View style={styles.chips}>
                  {words.map((word) => (
                    <View
                      key={word}
                      testID={`word-${key}-${word}`}
                      accessible
                      accessibilityLabel={withoutStress(word)}
                      {...voice}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: colors.tile,
                          borderColor: colors.line,
                          boxShadow: [
                            {
                              offsetX: 0,
                              offsetY: linkChip.depth,
                              blurRadius: 0,
                              color: colors.tileEdge,
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={[typeStyle('linkChip', tokens), { color: colors.ink }]}>
                        {word}
                      </Text>
                    </View>
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
          {tab.etymology.length === 0 ? null : (
            <DetailSection testID="word-etymology" title={strings.etymology}>
              {/* A paragraph per group of the dictionary's etymology, apart, so it reads as steps. */}
              <View style={styles.paragraphs}>
                {tab.etymology.map((paragraph, index) => (
                  <Text
                    key={index}
                    accessibilityLabel={withoutStress(paragraph)}
                    {...voice}
                    style={body}
                  >
                    {paragraph}
                  </Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    paddingHorizontal: linkChip.padding.horizontal,
    paddingVertical: linkChip.padding.vertical,
    borderRadius: linkChip.radius,
    borderWidth: 1,
  },
});
