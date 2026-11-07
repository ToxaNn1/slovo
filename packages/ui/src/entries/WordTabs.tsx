import type { FontSize } from '@slovo/contracts';
import { withoutStress, type WordCardModel } from '@slovo/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { FontSizeProvider, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { LabelChip } from '../primitives/LabelChip';
import { PagerScrollView } from '../primitives/VerticalPager';
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
import { wordTabsOf, type WordTab, type WordTabKey } from './word-tabs';

/** The smallest font size a tab too tall for the card shrinks to (ADR 0088). */
const FLOOR = 'S' satisfies FontSize;

/** The step below each font size above the floor, which a tab too tall for the card takes. */
const SMALLER: Readonly<Record<Exclude<FontSize, typeof FLOOR>, FontSize>> = {
  M: 'S',
  L: 'M',
  XL: 'L',
};

/**
 * How a tab's content sits in the card's fixed frame: whole at a font size
 * from the user's down to the floor, or at the floor scrolling inside the
 * tab (ADR 0088).
 */
type Fit = FontSize | 'scrolls';

/**
 * The Word card's tabs under its Lemma (ADR 0088): «Суть», «Приклад»,
 * «Зв’язки» and «Історія», without the empty ones, «Суть» selected first. A
 * card with «Суть» alone draws no tab bar. The selected tab's content fills
 * the rest of the card's fixed frame; one too tall takes the font size a step
 * smaller at a time down to the floor, and one too tall even there scrolls
 * inside the tab, so the card keeps its height. Nothing moves
 * between tabs, so Reduce Motion has nothing to stop.
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
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { step } = useWordTextSizes();
  const tabs = wordTabsOf(card);
  const [selectedKey, setSelectedKey] = useState<WordTabKey>('essence');
  const selected = tabs.find((tab) => tab.key === selectedKey) ?? tabs[0];
  // How the selected tab fit at the user's font size; another tab or size starts again at that size.
  const [fit, setFit] = useState<{ key: WordTabKey; step: FontSize; fit: Fit }>({
    key: 'essence',
    step,
    fit: step,
  });
  const fitNow = fit.key === selected.key && fit.step === step ? fit.fit : step;
  const [room, setRoom] = useState<number | undefined>(undefined);
  const measured = ({ nativeEvent }: LayoutChangeEvent) => {
    if (room === undefined || nativeEvent.layout.height <= room || fitNow === 'scrolls') return;
    setFit({ key: selected.key, step, fit: fitNow === FLOOR ? 'scrolls' : SMALLER[fitNow] });
  };
  const content = (
    <FontSizeProvider fontSize={fitNow === 'scrolls' ? FLOOR : fitNow}>
      <TabContent
        tab={selected}
        card={card}
        onOpenCorrection={onOpenCorrection}
        onOpenSynonymRow={onOpenSynonymRow}
        onHistoryShown={onHistoryShown}
      />
    </FontSizeProvider>
  );
  return (
    <View style={styles.tabs}>
      {tabs.length === 1 ? null : (
        <View role="tablist" style={[styles.bar, { borderBottomColor: colors.line }]}>
          {tabs.map(({ key }) => {
            const on = key === selected.key;
            return (
              <Pressable
                key={key}
                testID={`word-tab-${key}`}
                role="tab"
                aria-selected={on}
                accessibilityLabel={strings.wordCard.tabs[key]}
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
                  {strings.wordCard.tabs[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <View
        testID="word-tab-panel"
        style={styles.room}
        onLayout={({ nativeEvent }) => {
          setRoom(nativeEvent.layout.height);
        }}
      >
        {fitNow === 'scrolls' ? (
          <PagerScrollView testID="word-tab-scroll" contentContainerStyle={styles.content}>
            {content}
          </PagerScrollView>
        ) : (
          <View
            testID="word-tab-content"
            style={[styles.content, styles.overlay]}
            onLayout={measured}
          >
            {content}
          </View>
        )}
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
