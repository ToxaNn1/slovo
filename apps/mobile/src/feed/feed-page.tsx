import { FeedHeader, HeaderFade, SearchButton, space, useTokens } from '@slovo/ui';
import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditionInEffect } from '../edition/remote-switches';

/**
 * The Feed's header over the cards: the design's row of the logo, today and
 * the Streak pill (32), a gap (8), and the row of Search (40).
 */
export const TOP_ROW = 80;

/**
 * The Feed's header with nothing under the logo row (board p1, ADR 0091):
 * the room above the row (8), the row (32) and the room under it (14), where
 * the first card starts.
 */
export const LOGO_ROW = 54;

/**
 * The Feed header's rows: the status bar's height, and whether the row of
 * Search sits under the logo row while Search is shown (board p1, ADR 0091).
 */
export interface FeedHeaderRows {
  readonly top: number;
  readonly toolsRow: boolean;
}

/** The Feed header's rows in effect, the same object while they stay. */
export function useFeedHeaderRows(): FeedHeaderRows {
  const { top } = useSafeAreaInsets();
  const toolsRow = useEditionInEffect().isFeatureEnabled('searchButton');
  return useMemo(() => ({ top, toolsRow }), [top, toolsRow]);
}

/** The room a Feed page leaves under the status bar, by how its card starts. */
interface FeedClearance {
  /** Under the header's last row. */
  readonly row: number;
  /** Where a card the page's height starts: where the header ends under the logo row alone. */
  readonly card: number;
  /** A row's 8 points lower: the red card of the Word of the Day and Yesterday hang from it (board p1). */
  readonly hanging: number;
}

/** The one place the room under the Feed header is worked out. */
function feedClearance({ toolsRow }: FeedHeaderRows): FeedClearance {
  const row = toolsRow ? TOP_ROW : LOGO_ROW;
  return { row, card: toolsRow ? row + space[2] : row, hanging: row + space[2] };
}

/** How a Feed page lays out a card that does not lay out its own page. */
export interface FeedPageLayout {
  readonly style: keyof typeof layouts;
  readonly under: keyof FeedClearance;
}

/**
 * A page of the Feed, `feed-card-<position>`, under the status bar. An Entry
 * card lays out its own page from `entryPage` (a fixed frame or a scroll
 * inside the card); any other card is laid out by `layout`.
 */
export function FeedPageFrame({
  position,
  header,
  layout,
  children,
}: {
  position: number;
  header: FeedHeaderRows;
  layout?: FeedPageLayout | undefined;
  children: ReactNode;
}) {
  return (
    <View
      testID={`feed-card-${String(position)}`}
      style={[styles.page, { paddingTop: header.top }]}
    >
      {layout === undefined ? (
        children
      ) : (
        <View
          testID={`feed-card-${String(position)}-frame`}
          style={[
            styles.page,
            layouts[layout.style],
            { paddingTop: feedClearance(header)[layout.under] },
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}

/**
 * The page an Entry card lays itself out on in the Feed: a tabbed card in a
 * fixed frame where the header ends, the red card of the Word of the Day that
 * Self-check keeps closed scrolling from the top row.
 */
export function entryPage(header: FeedHeaderRows, position: number) {
  const clearance = feedClearance(header);
  return {
    testID: `feed-card-${String(position)}`,
    clearance: { framed: clearance.card, scrolled: clearance.hanging },
  };
}

/**
 * The header that stays put over the cards, on the screen's background from
 * the top edge, so a scrolled card passes under it unseen. Its lower edge
 * fades out inside the top row, so the card fades under it and the first card
 * at rest stays clear of the fade. The Feed has no XP bar over its cards
 * (board p1, ADR 0091): under the logo row only Search, while it is shown.
 */
export function FeedHeaderBar({
  header,
  onSearch,
  ...feedHeader
}: ComponentProps<typeof FeedHeader> & {
  header: FeedHeaderRows;
  onSearch: () => void;
}) {
  const { colors } = useTokens();
  return (
    <View
      testID="feed-header"
      pointerEvents="box-none"
      style={[
        styles.header,
        { paddingTop: header.top, height: header.top + feedClearance(header).row },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          testID="feed-header-backdrop"
          style={[styles.headerBackdrop, { backgroundColor: colors.background }]}
        />
        <HeaderFade testID="feed-header-fade" color={colors.background} />
      </View>
      <FeedHeader {...feedHeader} />
      {header.toolsRow && (
        <View testID="feed-header-tools" pointerEvents="box-none" style={styles.tools}>
          <View style={styles.headerButtons}>
            <SearchButton onPress={onSearch} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space[6],
    justifyContent: 'center',
    gap: space[2],
  },
  headerBackdrop: { flex: 1 },
  // Under the header: Search at the end.
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButtons: { marginLeft: 'auto', flexDirection: 'row', gap: space[2] },
  page: { flex: 1 },
});

const layouts = StyleSheet.create({
  // A card the page's height, closer to the edges, as the Word card (owner 16.11).
  hero: { flexGrow: 1, paddingHorizontal: space[3], paddingBottom: space[6] },
  // The Weekly Recap's page, closer to the edges, ends the board's 12 points over the tab bar
  // (board f5: 100 under the page, a bar of 88; check 15.11).
  stack: { flexGrow: 1, paddingHorizontal: space[3], paddingBottom: space[3] },
  // The end-of-Cycle card and a Feed Notice but Yesterday sit in the middle of the page.
  centred: { paddingHorizontal: space[6], paddingBottom: space[6] },
  // The goal-reached card fills its page to the board's 12 points from its sides (XFeed f4).
  goal: { paddingHorizontal: space[3], paddingBottom: space[3] },
});
