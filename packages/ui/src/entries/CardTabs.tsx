import type { FontSize } from '@slovo/contracts';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { FontSizeProvider, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { blockGap, minTouchTarget, space, typeStyle } from '../tokens';

/** The step below each font size, which content too tall for the card takes first (ADR 0088). */
const SMALLER: Readonly<Record<FontSize, FontSize>> = { S: 'S', M: 'S', L: 'M', XL: 'L' };

/**
 * How content sits in the card's fixed frame: at the user's font size, one
 * step smaller, or in the flow so the page scrolls (ADR 0088).
 */
type Fit = 'fits' | 'shrunk' | 'scrolls';

/**
 * An Entry card's tabs under its head (ADR 0088): a `tablist` of `tab`s by
 * their names, the first selected on opening, and the selected tab's content
 * in a `FitPanel`. A card with one tab draws no tab bar. Nothing moves between
 * tabs, so Reduce Motion has nothing to stop.
 */
export function CardTabs<Tab extends { readonly key: string }>({
  testID,
  tabs,
  nameOf,
  children,
}: {
  /** The kind of the Entry, which names each tab `<testID>-tab-<key>`. */
  testID: string;
  tabs: readonly [Tab, ...Tab[]];
  /** The tab's name from the Edition's strings. */
  nameOf: (tab: Tab) => string;
  /** What the selected tab shows. */
  children: (tab: Tab) => ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const [selectedKey, setSelectedKey] = useState(tabs[0].key);
  const selected = tabs.find((tab) => tab.key === selectedKey) ?? tabs[0];
  return (
    <View style={styles.tabs}>
      {tabs.length === 1 ? null : (
        <View role="tablist" style={[styles.bar, { borderBottomColor: colors.line }]}>
          {tabs.map((tab) => {
            const on = tab.key === selected.key;
            return (
              <Pressable
                key={tab.key}
                testID={`${testID}-tab-${tab.key}`}
                role="tab"
                aria-selected={on}
                accessibilityLabel={nameOf(tab)}
                {...voice}
                onPress={() => {
                  setSelectedKey(tab.key);
                }}
                style={[styles.tab, { borderBottomColor: on ? colors.accent : 'transparent' }]}
              >
                <Text
                  style={[
                    typeStyle('chipLabel', tokens),
                    { color: on ? colors.ink : colors.muted },
                  ]}
                >
                  {nameOf(tab)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <FitPanel testID={`${testID}-tab-panel`} fitKey={selected.key}>
        {children(selected)}
      </FitPanel>
    </View>
  );
}

/**
 * Content that fills the rest of an Entry card's fixed frame (ADR 0088):
 * content too tall for it takes the font size a step smaller, and content too
 * tall even then, or at S, makes the page scroll. The card measures the drawn
 * height once it is laid out; a new `fitKey` (another tab) starts at the
 * user's font size again.
 */
export function FitPanel({
  testID,
  fitKey,
  children,
}: {
  testID: string;
  fitKey: string;
  children: ReactNode;
}) {
  const { step } = useWordTextSizes();
  const [fit, setFit] = useState<{ key: string; fit: Fit }>({ key: fitKey, fit: 'fits' });
  const fitNow = fit.key === fitKey ? fit.fit : 'fits';
  const [room, setRoom] = useState<number | undefined>(undefined);
  const measured = ({ nativeEvent }: LayoutChangeEvent) => {
    if (room === undefined || nativeEvent.layout.height <= room || fitNow === 'scrolls') return;
    setFit({ key: fitKey, fit: fitNow === 'fits' && step !== 'S' ? 'shrunk' : 'scrolls' });
  };
  return (
    <View
      testID={testID}
      style={fitNow === 'scrolls' ? undefined : styles.room}
      onLayout={({ nativeEvent }) => {
        if (fitNow !== 'scrolls') setRoom(nativeEvent.layout.height);
      }}
    >
      <View style={[styles.content, fitNow !== 'scrolls' && styles.overlay]} onLayout={measured}>
        <FontSizeProvider fontSize={fitNow === 'shrunk' ? SMALLER[step] : step}>
          {children}
        </FontSizeProvider>
      </View>
    </View>
  );
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
});
