'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { FontSize } from '@slovo/contracts';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { FontSizeProvider, useWordTextSizes } from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { Wedge } from '../primitives/Wedge';
import {
  blockGap,
  entryCardFrame,
  minTouchTarget,
  motion,
  space,
  typeStyle,
  wedges,
} from '../tokens';

/** The smallest font size content too tall for the card shrinks to (ADR 0091). */
const FLOOR = 'S' satisfies FontSize;

/** The step below each font size above the floor, which content too tall for the card takes. */
const SMALLER: Readonly<Record<Exclude<FontSize, typeof FLOOR>, FontSize>> = {
  M: 'S',
  L: 'M',
  XL: 'L',
};

/**
 * How content sits in the card's fixed frame: whole at a font size from the
 * user's down to the floor, or at the floor clamped to the frame under
 * «Детальніше» (ADR 0091).
 */
type Fit = FontSize | 'clamped';

/** How the room grows to a clamped tab's whole height once «Детальніше» is tapped. */
const growEasing = Easing.bezier(...motion.collapse.easing);

/**
 * An Entry card's tabs under its head (ADR 0091): the selected tab's content
 * in a `FitPanel`, and at the card's foot a `tablist` of `tab`s by their
 * names, a red slanted mark over the selected one (board p1), the first
 * selected on opening. A card with one tab draws no tab bar. Nothing moves between
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
      <FitPanel testID={testID} fitKey={selected.key}>
        {disabled ? null : children(selected)}
      </FitPanel>
      {tabs.length === 1 ? null : (
        <View accessibilityRole="tablist" style={[styles.bar, { borderTopColor: colors.line }]}>
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
                style={styles.tab}
              >
                {on && !disabled && (
                  <View testID={`${testID}-tab-${tab.key}-bar`} style={styles.mark}>
                    <Wedge
                      points={wedges.slant}
                      color={colors.accent}
                      width="100%"
                      height={entryCardFrame.tabMark.height}
                    />
                  </View>
                )}
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
    </View>
  );
}

/**
 * Content that fills the rest of an Entry card's fixed frame (ADR 0091):
 * content too tall for it takes the font size a step smaller at a time down
 * to the floor, S, and content too tall even there stays at S, clamped to the
 * frame, with «Детальніше» under it. A tap on it grows the room to the whole
 * content, smoothly unless Reduce Motion is on, and the card grows with it,
 * so the page scrolls over the card. The card measures the
 * drawn height against the room once both are laid out, on the render after
 * they arrive, so two heights reported in one layout pass are both read. Each
 * size draws its content in a new view, which the device always lays out and
 * reports, even when the smaller size leaves the height as it was (text in a
 * fixed type role). A new `fitKey` (another tab) or font size starts at the
 * user's font size again, clamped. Its parts are `<testID>-tab-panel`,
 * `<testID>-tab-content` and, while clamped, `<testID>-tab-more`.
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
  const tokens = useTokens();
  const { strings, voice } = useEdition();
  const reduceMotion = useReduceMotion();
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
  // Content too tall for the room takes the next smaller size, or is clamped at the floor.
  if (fitNow !== 'clamped' && room !== undefined && drawn?.at === drawnAt && drawn.height > room) {
    setFit({ key: fitKey, step, fit: fitNow === FLOOR ? 'clamped' : SMALLER[fitNow] });
  }
  // «Детальніше» opens the tab at the size it was tapped on, until another tab or font size.
  const [openAt, setOpenAt] = useState<string | undefined>(undefined);
  const open = fitNow === 'clamped' && openAt === drawnAt;
  const height = useSharedValue(0);
  // A style key once set stays until it is set again, so a closed room sets its least height back to 0.
  const grown = useAnimatedStyle(() => ({ minHeight: open ? height.value : 0 }));
  return (
    <>
      <Animated.View
        testID={`${testID}-tab-panel`}
        style={[styles.room, grown]}
        onLayout={({ nativeEvent }) => {
          setRoom(nativeEvent.layout.height);
        }}
      >
        <View
          key={drawnAt}
          testID={`${testID}-tab-content`}
          style={[styles.content, styles.overlay]}
          onLayout={({ nativeEvent }) => {
            setDrawn({ at: drawnAt, height: nativeEvent.layout.height });
          }}
        >
          <FontSizeProvider fontSize={fitNow === 'clamped' ? FLOOR : fitNow}>
            {children}
          </FontSizeProvider>
        </View>
      </Animated.View>
      {fitNow === 'clamped' && !open && (
        <Pressable
          testID={`${testID}-tab-more`}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          {...voice}
          onPress={() => {
            const whole = drawn?.at === drawnAt ? drawn.height : (room ?? 0);
            height.value = room ?? 0;
            height.value = reduceMotion
              ? whole
              : withTiming(whole, { duration: motion.collapse.duration, easing: growEasing });
            setOpenAt(drawnAt);
          }}
          style={styles.more}
        >
          <Text style={[typeStyle('textLink', tokens), { color: tokens.colors.accent }]}>
            {strings.wordCard.tabMore}
          </Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // The tabs fill what the head leaves of the card's frame.
  tabs: { flexGrow: 1, gap: blockGap },
  // The tabs stand packed from the left, under a hairline (owner 08.11).
  bar: { flexDirection: 'row', borderTopWidth: 1, gap: space[6] },
  tab: { minHeight: minTouchTarget, justifyContent: 'center' },
  // The mark lies over the hairline and reaches past the tab's name on both sides.
  mark: {
    position: 'absolute',
    top: -1,
    left: -entryCardFrame.tabMark.overhang,
    right: -entryCardFrame.tabMark.overhang,
  },
  room: { flexGrow: 1, flexBasis: 0, overflow: 'hidden' },
  content: { gap: blockGap },
  more: { minHeight: minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  // While it fits, the content takes no room of its own, so the frame keeps its height.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
