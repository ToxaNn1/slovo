import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PagerScrollView } from '../primitives/VerticalPager';
import { space } from '../tokens';

/**
 * The page an Entry card lays itself out on: the room above it, as a fixed
 * frame and as a card that scrolls, and the testID its frame or scroll takes
 * after.
 */
export interface EntryCardPage {
  /** Names the frame `<testID>-frame` and the scroll `<testID>-scroll`. */
  testID: string;
  clearance: {
    /** Above a tabbed card in its fixed frame. */
    framed: number;
    /** Above the red card of the Word of the Day that scrolls. */
    scrolled: number;
  };
}

/**
 * A tabbed card is a fixed frame the page's height: nothing around it scrolls,
 * only an opened tab inside it, so its frame and tab bar never move (ADR 0091).
 * Any other card, the red one of the Word of the Day Self-check keeps closed,
 * scrolls, under the room above it.
 */
export function CardPage({
  page,
  framed,
  children,
}: {
  page: EntryCardPage;
  framed: boolean;
  children: ReactNode;
}) {
  return framed ? (
    <View
      testID={`${page.testID}-frame`}
      style={[styles.page, styles.content, { paddingTop: page.clearance.framed }]}
    >
      {children}
    </View>
  ) : (
    <PagerScrollView
      testID={`${page.testID}-scroll`}
      contentContainerStyle={[styles.content, { paddingTop: page.clearance.scrolled }]}
    >
      {children}
    </PagerScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  // The card closer to the edges, the board's 24 points over the bottom.
  content: { flexGrow: 1, paddingHorizontal: space[3], paddingBottom: space[6] },
});
