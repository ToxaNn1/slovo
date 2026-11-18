import { useState, type ReactNode } from 'react';
import { smallerTextSize } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import {
  FontSizeProvider,
  useWordTextSizes,
  type TextSizeStep,
} from '../providers/FontSizeProvider';
import { useTokens } from '../providers/TokensProvider';
import { PagerScrollView } from '../primitives/VerticalPager';
import { Wedge } from '../primitives/Wedge';
import { useDrawnLines, WholeLinesText, WholeLinesView } from '../primitives/WholeLines';
import { wholeLinesCut } from '../primitives/whole-lines-cut';
import { blockGap, entryCardFrame, minTouchTarget, typeStyle, wedges } from '../tokens';
import { capitalised } from './capitalised';

/**
 * How content sits in the card's fixed frame: whole at a size from the
 * user's down to the floor of its scale, or at the floor clamped to the frame
 * under «Детальніше» (ADR 0091, 0134).
 */
interface Fit {
  readonly size: TextSizeStep;
  readonly clamped: boolean;
}

/**
 * An Entry card's tabs under its head (ADR 0091): the selected tab's content
 * in a `FitPanel`, and at the card's foot a `tablist` of `tab`s by their
 * names, a red slanted mark over the selected one (board p1), the first
 * selected on opening. A card with one tab draws no tab bar. Nothing moves between
 * tabs, so Reduce Motion has nothing to stop. Under Self-check the tabs are
 * there but disabled, and the panel shows nothing, until the reveal. Given
 * `sources` (while `sourceTab` is on) that are not empty, the last tab is
 * «Джерело», naming each source on its own line, `<testID>-source-<n>`
 * (ADR 0116).
 */
export function CardTabs<Tab extends { readonly key: string }>({
  testID,
  tabs: ownTabs,
  nameOf,
  sources: allSources = [],
  disabled = false,
  children,
}: {
  /** The kind of the Entry, which names each tab `<testID>-tab-<key>`. */
  testID: string;
  tabs: readonly [Tab, ...Tab[]];
  /** The tab's name from the Edition's strings. */
  nameOf: (tab: Tab) => string;
  /** The names of the Entry's sources for the last tab «Джерело», given only while `sourceTab` is on (ADR 0116). */
  sources?: readonly string[] | undefined;
  /** Self-check conceals the card: the tabs take no tap and the panel stays empty. */
  disabled?: boolean;
  /** What the selected tab shows. */
  children: (tab: Tab) => ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, strings } = useEdition();
  // The Edition's own editing is no source to name (ADR 0154).
  const sources = allSources.filter((source) => source !== strings.wordCard.ownSource);
  const [first, ...rest] = ownTabs;
  const tabs: readonly [CardTab<Tab>, ...CardTab<Tab>[]] = [
    { key: first.key, own: first },
    ...rest.map((tab) => ({ key: tab.key, own: tab })),
    ...(sources.length === 0 ? [] : [SOURCE_TAB]),
  ];
  const [selectedKey, setSelectedKey] = useState(tabs[0].key);
  const selected = tabs.find((tab) => tab.key === selectedKey) ?? tabs[0];
  const nameOfTab = (tab: CardTab<Tab>) =>
    tab.own === undefined ? strings.wordCard.tabSource : nameOf(tab.own);
  return (
    <View style={styles.tabs}>
      {/* Another tab starts afresh: at the user's font size, not opened. */}
      <FitPanel key={selected.key} testID={testID} fitKey={selected.key}>
        {disabled
          ? null
          : selected.own === undefined
            ? sources.map((source, index) => (
                <WholeLinesText
                  key={index}
                  testID={`${testID}-source-${String(index)}`}
                  {...voice}
                  style={[typeStyle('meta', tokens), { color: colors.muted }]}
                >
                  {capitalised(source, voice.accessibilityLanguage)}
                </WholeLinesText>
              ))
            : children(selected.own)}
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
                accessibilityLabel={nameOfTab(tab)}
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
                {/* A long name shrinks to keep to one line in its column, never breaking mid-word (owner 15.11). */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={[
                    on && !disabled
                      ? [typeStyle('cardTabSelected', tokens), { color: colors.ink }]
                      : [typeStyle('cardTab', tokens), { color: colors.muted }],
                    styles.name,
                  ]}
                >
                  {nameOfTab(tab)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** One of the card's tabs: the kind's `own`, or with none the «Джерело» tab (ADR 0116). */
type CardTab<Tab> = { readonly key: string; readonly own: Tab } | typeof SOURCE_TAB;

/** The «Джерело» tab, which a kind's own tab keys never take. */
const SOURCE_TAB = { key: 'source', own: undefined } as const;

/**
 * Content that fills the rest of an Entry card's fixed frame (ADR 0091):
 * content too tall for it takes the text size a step smaller at a time down
 * the scale in effect to its floor (S of S…XL, «Як у системі» on the ladder of
 * ADR 0134), and content too tall even there stays at the floor, clamped to the
 * frame at whole lines, never through one, with «Детальніше» a little under
 * the last line shown (`entryCardFrame.moreGap`), inside the room: every `WholeLinesText` and `useWholeBlock` in it reports
 * its lines, and the clip ends under the lowest that fits above the link
 * (`wholeLinesCut`). A tap on it opens the whole content in a
 * scroll inside the room, so the card keeps its frame and only the card
 * scrolls, never the page (ADR 0113); «Сховати» takes «Детальніше»'s place
 * in the room under the scroll, which fills the rest of the room, and clamps
 * the content to the frame again at once. The card measures the
 * drawn height against the room once both are laid out, on the render after
 * they arrive, so two heights reported in one layout pass are both read. Each
 * size draws its content in a new view, which the device always lays out and
 * reports, even when the smaller size leaves the height as it was (text in a
 * fixed type role). A new `fitKey` (another tab) or text size starts at the
 * user's text size again, clamped. Its parts are `<testID>-tab-panel`,
 * `<testID>-tab-content` and, while clamped, `<testID>-tab-clip` and `<testID>-tab-more`, or once
 * opened, `<testID>-tab-scroll` and `<testID>-tab-less`.
 */
function FitPanel({
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
  const { size } = useWordTextSizes();
  const from = size;
  const [fit, setFit] = useState<{ key: string; from: string; fit: Fit }>({
    key: fitKey,
    from,
    fit: { size, clamped: false },
  });
  const fitNow: Fit = fit.key === fitKey && fit.from === from ? fit.fit : { size, clamped: false };
  const [room, setRoom] = useState<number | undefined>(undefined);
  // The drawn height counts only for the tab and text size it was drawn at.
  const drawnAt = `${fitKey} ${from} ${fitNow.size}${fitNow.clamped ? ' clamped' : ''}`;
  const [drawn, setDrawn] = useState<{ at: string; height: number } | undefined>(undefined);
  // Content too tall for the room takes the next smaller size, or is clamped at the floor.
  if (!fitNow.clamped && room !== undefined && drawn?.at === drawnAt && drawn.height > room) {
    const smaller = smallerTextSize(fitNow.size);
    setFit({
      key: fitKey,
      from,
      fit:
        smaller === undefined
          ? { size: fitNow.size, clamped: true }
          : { size: smaller, clamped: false },
    });
  }
  // «Детальніше» opens the tab at the size it was tapped on, until «Сховати», another tab or font size.
  const [openAt, setOpenAt] = useState<string | undefined>(undefined);
  const open = fitNow.clamped && openAt === drawnAt;
  const clamped = fitNow.clamped && !open;
  // Clamped content shows whole lines only, «Детальніше» right under the last of them.
  const { lines, report } = useDrawnLines();
  const [linkHeight, setLinkHeight] = useState(0);
  const cut =
    room === undefined
      ? undefined
      : wholeLinesCut(room - linkHeight - entryCardFrame.moreGap, lines);
  const content = (
    <WholeLinesView
      key={drawnAt}
      report={report}
      testID={`${testID}-tab-content`}
      style={open ? styles.content : [styles.content, styles.overlay]}
      onLayout={({ nativeEvent }) => {
        setDrawn({ at: drawnAt, height: nativeEvent.layout.height });
      }}
    >
      <FontSizeProvider size={fitNow.size}>{children}</FontSizeProvider>
    </WholeLinesView>
  );
  // «Детальніше» and «Сховати» take only their line in the room, their touch target reaching past it.
  const link = (name: 'more' | 'less', expanded: boolean, onPress: () => void) => (
    <Pressable
      testID={`${testID}-tab-${name}`}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      {...voice}
      hitSlop={{
        top: Math.max(0, (minTouchTarget - linkHeight) / 2),
        bottom: Math.max(0, (minTouchTarget - linkHeight) / 2),
      }}
      onLayout={({ nativeEvent }) => {
        setLinkHeight(nativeEvent.layout.height);
      }}
      onPress={onPress}
      style={styles.link}
    >
      <Text style={[typeStyle('textLink', tokens), { color: tokens.colors.accentText }]}>
        {expanded ? strings.wordCard.tabLess : strings.wordCard.tabMore}
      </Text>
    </Pressable>
  );
  return (
    <View
      testID={`${testID}-tab-panel`}
      style={fitNow.clamped ? [styles.room, styles.linkRoom] : styles.room}
      onLayout={({ nativeEvent }) => {
        setRoom(nativeEvent.layout.height);
      }}
    >
      {/* Only the card scrolls: the opened tab scrolls in the room, which keeps the frame's height
          (ADR 0113); in the Feed a swipe scrolls it and turns the page at its ends. «Сховати» takes
          «Детальніше»'s place under it, so the scroll fills the room down to the link (owner 13.11). */}
      {open ? (
        <>
          <PagerScrollView testID={`${testID}-tab-scroll`} contentContainerStyle={styles.scrolled}>
            {content}
          </PagerScrollView>
          {link('less', true, () => {
            setOpenAt(undefined);
          })}
        </>
      ) : clamped ? (
        <>
          <View testID={`${testID}-tab-clip`} style={[styles.clip, { height: cut }]}>
            {content}
          </View>
          {link('more', false, () => {
            setOpenAt(drawnAt);
          })}
        </>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The tabs fill what the head leaves of the card's frame.
  tabs: { flexGrow: 1, gap: blockGap },
  // The tabs share the bar's width under its line (board XEntry2, owner 13.11): each column is its
  // name and an equal share of the room left, so every pair of names has the same air between them,
  // and a long name shrinks its column, never the padding between (check 15.11).
  bar: { flexDirection: 'row', borderTopWidth: entryCardFrame.tabBar.line },
  tab: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    paddingHorizontal: entryCardFrame.tabBar.nameGap / 2,
    height: entryCardFrame.tabBar.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { textAlign: 'center' },
  // The mark lies over the line, over the middle of its column.
  mark: {
    position: 'absolute',
    top: entryCardFrame.tabMark.top,
    left: entryCardFrame.tabMark.inset,
    right: entryCardFrame.tabMark.inset,
  },
  room: { flexGrow: 1, flexBasis: 0, overflow: 'hidden' },
  // Clamped or opened, the clip or the scroll cuts the content, and the link's touch target may
  // reach out of the room.
  linkRoom: { overflow: 'visible' },
  clip: { overflow: 'hidden' },
  // A little air between the last whole line, or the scroll, and the link, both in the room (owner 13.11).
  link: { alignSelf: 'flex-start', marginTop: entryCardFrame.moreGap },
  content: { gap: entryCardFrame.panelGap },
  // The opened tab's text keeps clear of the scroll bar at the room's right edge (owner 14.11).
  scrolled: { paddingRight: entryCardFrame.scrollGutter },
  // While it fits, the content takes no room of its own, so the frame keeps its height.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
