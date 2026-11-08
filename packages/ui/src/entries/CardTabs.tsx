import type { FontSize } from '@slovo/contracts';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { FontSizeProvider, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { PagerScrollView } from '../primitives/VerticalPager';
import { blockGap, minTouchTarget, space, typeStyle } from '../tokens';

/** The smallest font size content too tall for the card shrinks to (ADR 0088). */
const FLOOR = 'S' satisfies FontSize;

/** The step below each font size above the floor, which content too tall for the card takes. */
const SMALLER: Readonly<Record<Exclude<FontSize, typeof FLOOR>, FontSize>> = {
  M: 'S',
  L: 'M',
  XL: 'L',
};

/**
 * How content sits in the card's fixed frame: whole at a font size from the
 * user's down to the floor, or at the floor scrolling inside the frame
 * (ADR 0088).
 */
type Fit = FontSize | 'scrolls';

/**
 * An Entry card's tabs under its head (ADR 0088): a `tablist` of `tab`s by
 * their names, the first selected on opening, and the selected tab's content
 * in a `FitPanel`. A card with one tab draws no tab bar. Nothing moves between
 * tabs, so Reduce Motion has nothing to stop. Under Self-check the tabs are
 * there but disabled, and the panel shows nothing, until the reveal.
 */
export function CardTabs<Tab extends { readonly key: string }>({
  testID,
  tabs,
  nameOf,
  disabled = false,
  children,
}: {
  /** The kind of the Entry, which names each tab `<testID>-tab-<key>`. */
  testID: string;
  tabs: readonly [Tab, ...Tab[]];
  /** The tab's name from the Edition's strings. */
  nameOf: (tab: Tab) => string;
  /** Self-check conceals the card: the tabs take no tap and the panel stays empty. */
  disabled?: boolean;
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
        <View accessibilityRole="tablist" style={[styles.bar, { borderBottomColor: colors.line }]}>
          {tabs.map((tab) => {
            const on = tab.key === selected.key;
            return (
              <Pressable
                key={tab.key}
                testID={`${testID}-tab-${tab.key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled }}
                disabled={disabled}
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
                    { color: on && !disabled ? colors.ink : colors.muted },
                  ]}
                >
                  {nameOf(tab)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <FitPanel testID={testID} fitKey={selected.key}>
        {disabled ? null : children(selected)}
      </FitPanel>
    </View>
  );
}

/**
 * Content that fills the rest of an Entry card's fixed frame (ADR 0088):
 * content too tall for it takes the font size a step smaller at a time down
 * to the floor, S, and content too tall even there stays at S and scrolls
 * inside the frame, so the card keeps its height. In the Feed that scroll is
 * the page's (`PagerScrollView` nested in the page's). The card measures the
 * drawn height against the room whenever either is laid out; a new `fitKey` (another tab) or font size
 * starts at the user's font size again. Its parts are `<testID>-tab-panel`,
 * `<testID>-tab-content` while it fits and `<testID>-tab-scroll` once it
 * scrolls.
 */
export function FitPanel({
  testID,
  fitKey,
  children,
}: {
  /** The kind of the Entry, which names the panel's parts. */
  testID: string;
  fitKey: string;
  children: ReactNode;
}) {
  const { step } = useWordTextSizes();
  const [fit, setFit] = useState<{ key: string; step: FontSize; fit: Fit }>({
    key: fitKey,
    step,
    fit: step,
  });
  const fitNow = fit.key === fitKey && fit.step === step ? fit.fit : step;
  const [room, setRoom] = useState<number | undefined>(undefined);
  // The drawn height counts only for the tab and font size it was drawn at.
  const drawnAt = `${fitKey} ${step} ${fitNow}`;
  const [drawn, setDrawn] = useState<{ at: string; height: number } | undefined>(undefined);
  // Either height may arrive or change last, so the fit is checked whenever both are known.
  const tooTall = room !== undefined && drawn?.at === drawnAt && drawn.height > room;
  useEffect(() => {
    if (!tooTall || fitNow === 'scrolls') return;
    setFit({ key: fitKey, step, fit: fitNow === FLOOR ? 'scrolls' : SMALLER[fitNow] });
  }, [tooTall, fitNow, fitKey, step]);
  const measured = ({ nativeEvent }: LayoutChangeEvent) => {
    setDrawn({ at: drawnAt, height: nativeEvent.layout.height });
  };
  const content = (
    <FontSizeProvider fontSize={fitNow === 'scrolls' ? FLOOR : fitNow}>{children}</FontSizeProvider>
  );
  return (
    <View
      testID={`${testID}-tab-panel`}
      style={styles.room}
      onLayout={({ nativeEvent }) => {
        setRoom(nativeEvent.layout.height);
      }}
    >
      {fitNow === 'scrolls' ? (
        <PagerScrollView testID={`${testID}-tab-scroll`} contentContainerStyle={styles.content}>
          {content}
        </PagerScrollView>
      ) : (
        <View
          testID={`${testID}-tab-content`}
          style={[styles.content, styles.overlay]}
          onLayout={measured}
        >
          {content}
        </View>
      )}
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
