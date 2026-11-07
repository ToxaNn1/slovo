import type { FontSize } from '@slovo/contracts';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { FontSizeProvider, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { blockGap, minTouchTarget, space, typeStyle } from '../tokens';

/** The step below each font size, which a tab too tall for the card takes first (ADR 0088). */
const SMALLER: Readonly<Record<FontSize, FontSize>> = { S: 'S', M: 'S', L: 'M', XL: 'L' };

/**
 * How a tab's content sits in the card's fixed frame: at the user's font
 * size, one step smaller, or in the flow so the page scrolls (ADR 0088).
 */
type Fit = 'fits' | 'shrunk' | 'scrolls';

/**
 * An Entry card's tabs under its head (ADR 0088), the first selected on
 * opening. A card with one tab draws no tab bar. The selected tab's content
 * fills the rest of the card's fixed frame; one too tall takes the font size
 * a step smaller, and one too tall even then makes the page scroll. Nothing
 * moves between tabs, so Reduce Motion has nothing to stop.
 */
export function EntryTabs<Key extends string, Tab extends { readonly key: Key }>({
  tabs,
  names,
  testID,
  children,
}: {
  /** The card's tabs in order, never empty. */
  tabs: readonly [Tab, ...Tab[]];
  /** Each tab's name, from the Edition's strings. */
  names: Readonly<Record<Key, string>>;
  /** The card's kind, which prefixes the tabs' test IDs. */
  testID: string;
  /** What the selected tab shows. */
  children: (tab: Tab) => ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { step } = useWordTextSizes();
  const [first] = tabs;
  const [selectedKey, setSelectedKey] = useState<Key>(first.key);
  const selected = tabs.find((tab) => tab.key === selectedKey) ?? first;
  const [fit, setFit] = useState<{ key: Key; fit: Fit }>({ key: first.key, fit: 'fits' });
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
          {tabs.map(({ key }) => {
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
