import type { FontSize } from '@slovo/contracts';
import { withoutStress, type WordCardModel } from '@slovo/core';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { FontSizeProvider, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { LabelChip } from '../primitives/LabelChip';
import { blockGap, minTouchTarget, space, typeStyle } from '../tokens';
import { CategoryChip } from './CategoryChip';
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

/** The step below each font size, which a tab too tall for the card takes first (ADR 0088). */
const SMALLER: Readonly<Record<FontSize, FontSize>> = { S: 'S', M: 'S', L: 'M', XL: 'L' };

/**
 * How a tab's content sits in the card's fixed frame: at the user's font
 * size, one step smaller, or in the flow so the page scrolls (ADR 0088).
 */
type Fit = 'fits' | 'shrunk' | 'scrolls';

/**
 * The Word card's tabs under its Lemma (ADR 0088): «Суть», «Приклад»,
 * «Зв’язки» and «Історія», without the empty ones, in the `EntryTabs` frame.
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
    <EntryTabs testID="word" tabs={wordTabsOf(card)} names={strings.wordCard.tabs}>
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

/**
 * An Entry card's tabs under its head (ADR 0088), the first selected on
 * opening. A card with one tab alone draws no tab bar. The selected tab's
 * content fills the rest of the card's fixed frame; one too tall takes the
 * font size a step smaller, and one too tall even then makes the page scroll.
 * Nothing moves between tabs, so Reduce Motion has nothing to stop.
 */
export function EntryTabs<Key extends string, Tab extends { readonly key: Key }>({
  testID,
  tabs,
  names,
  children,
}: {
  /** The card's kind, which names the tabs' test IDs, e.g. `word-tab-essence`. */
  testID: string;
  tabs: readonly [Tab, ...Tab[]];
  /** The name of each tab, from the Edition's strings. */
  names: Readonly<Record<Key, string>>;
  /** What the selected tab shows. */
  children: (tab: Tab) => ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { step } = useWordTextSizes();
  const [selectedKey, setSelectedKey] = useState<Key>(tabs[0].key);
  const selected = tabs.find((tab) => tab.key === selectedKey) ?? tabs[0];
  const [fit, setFit] = useState<{ key: Key; fit: Fit }>({ key: tabs[0].key, fit: 'fits' });
  const fitNow = fit.key === selected.key ? fit.fit : 'fits';
  const [room, setRoom] = useState<number | undefined>(undefined);
  const measured = ({ nativeEvent }: LayoutChangeEvent) => {
    if (room === undefined || nativeEvent.layout.height <= room || fitNow === 'scrolls') return;
    setFit({ key: selected.key, fit: fitNow === 'fits' && step !== 'S' ? 'shrunk' : 'scrolls' });
  };
  return (
    <View style={styles.tabs}>
      {tabs.length === 1 ? null : (
        <View role="tablist" style={[styles.bar, { borderBottomColor: colors.line }]}>
          {tabs.map((tab) => {
            const { key } = tab;
            const on = key === selected.key;
            const name = names[key];
            return (
              <Pressable
                key={key}
                testID={`${testID}-tab-${key}`}
                role="tab"
                aria-selected={on}
                accessibilityLabel={name}
                {...voice}
                onPress={() => {
                  setSelectedKey(key);
                }}
                style={[styles.tab, { borderBottomColor: on ? colors.accent : 'transparent' }]}
              >
                <Text
                  style={[
                    typeStyle('chipLabel', tokens),
                    { color: on ? colors.ink : colors.muted },
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View
        testID={`${testID}-tab-panel`}
        style={fitNow === 'scrolls' ? undefined : styles.room}
        onLayout={({ nativeEvent }) => {
          if (fitNow !== 'scrolls') setRoom(nativeEvent.layout.height);
        }}
      >
        <View style={[styles.content, fitNow !== 'scrolls' && styles.overlay]} onLayout={measured}>
          <FontSizeProvider fontSize={fitNow === 'shrunk' ? SMALLER[step] : step}>
            {children(selected)}
          </FontSizeProvider>
        </View>
      </View>
    </View>
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
  // The tabs fill what the head leaves of the card's frame.
  tabs: { flexGrow: 1, gap: blockGap },
  bar: { flexDirection: 'row', borderBottomWidth: 1, gap: space[4] },
  tab: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  room: { flexGrow: 1, flexBasis: 0, overflow: 'hidden' },
  content: { gap: blockGap },
  // While it fits, the content takes no room of its own, so the frame keeps its height.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  links: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
