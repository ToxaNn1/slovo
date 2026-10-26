import type { FeedCard } from '@slovo/core';
import {
  DecorBackground,
  EndOfCycleCard,
  EntryCard,
  PagerScrollView,
  Placeholder,
  space,
  SwipeHint,
  UndoToastProvider,
  useTokens,
  VerticalPager,
  type VerticalPagerHandle,
} from '@slovo/ui';
import { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '../edition/edition';
import { EntryActions } from '../entries/entry-actions';
import { useOpenScreen } from '../entries/use-open-screen';
import { useFeed } from '../feed/feed';
import { TOP_ROW } from '../edition/feed-loading';
import { StatsPillAndSheet } from '../progress';
import { useShown } from '../shown-in-effect';
import { useSwipeHint } from '../feed/swipe-hint';

const { feed: feedStrings } = editionStrings;
const turnActionLabels = { next: feedStrings.nextEntry, previous: feedStrings.previousEntry };

/**
 * Home is the Feed: a vertical stream of Entry cards, one per screen. Its undo
 * toasts outlive the card they came from, also when no card is left.
 */
export default function HomeScreen() {
  return (
    <UndoToastProvider>
      <FeedScreen />
    </UndoToastProvider>
  );
}

function FeedScreen() {
  const pager = useRef<VerticalPagerHandle>(null);
  const feed = useFeed(pager);
  const swipeHint = useSwipeHint();
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();

  const { cards, onCardChange, openCorrection } = feed;
  const { dismiss: dismissSwipeHint } = swipeHint;
  // Kept from render to render: a swipe re-renders the pager, and its pages
  // re-render only when their card changes.
  const renderPage = useCallback(
    (card: FeedCard, position: number) => (
      <FeedPage
        // A card that takes the place of a hidden one starts afresh, scrolled to its top.
        key={card.entryId ?? card.kind}
        card={card}
        position={position}
        onOpenCorrection={openCorrection}
      />
    ),
    [openCorrection],
  );
  const onIndexChange = useCallback(
    (position: number) => {
      onCardChange(position);
      dismissSwipeHint();
    },
    [onCardChange, dismissSwipeHint],
  );

  if (cards.length === 0) return <Placeholder message={editionStrings.noWords} />;

  return (
    <View testID="home" style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The background stays put while the cards move over it. */}
      <DecorBackground />
      <VerticalPager
        ref={pager}
        testID="feed"
        items={cards}
        initialIndex={feed.startPosition}
        renderPage={renderPage}
        onIndexChange={onIndexChange}
        turnActionLabels={turnActionLabels}
      />
      {/* The top row stays put over the cards, like the background. */}
      <View pointerEvents="box-none" style={[styles.topRow, { top }]}>
        <StatsPillAndSheet />
      </View>
      {swipeHint.visible ? (
        <SwipeHint
          text={feedStrings.swipeHint}
          onShown={swipeHint.markShown}
          onDismiss={swipeHint.dismiss}
        />
      ) : null}
    </View>
  );
}

const FeedPage = memo(function FeedPage({
  card,
  position,
  onOpenCorrection,
}: {
  card: FeedCard;
  position: number;
  /** Opens the Correction that the Word card at `position` links. */
  onOpenCorrection: (position: number, correctionId: string) => void;
}) {
  const { top } = useSafeAreaInsets();
  const { selfCheck } = useShown();
  const openScreen = useOpenScreen();
  if (card.kind === 'end-of-cycle')
    return (
      <View
        testID={`feed-card-${String(position)}`}
        style={[styles.page, styles.endOfCycle, { paddingTop: top + TOP_ROW }]}
      >
        <EndOfCycleCard />
      </View>
    );
  return (
    // The content scrolls under the top row but stops at the status bar.
    <View testID={`feed-card-${String(position)}`} style={[styles.page, { paddingTop: top }]}>
      <PagerScrollView contentContainerStyle={styles.content}>
        {card.kind === 'tip' ? (
          // Its action row comes with the tickets that hide, list and share Tips (spec #730).
          <EntryCard card={card} selfCheck={selfCheck} />
        ) : card.kind === 'synonymRow' ? (
          // Its action row comes with the tickets that hide, list and share rows (spec #730).
          <EntryCard
            card={card}
            // A member opens its Word over the Feed, Hidden or out of the Mix alike.
            onOpenWord={(wordId) => {
              openScreen(`/entry/${wordId}`);
            }}
            selfCheck={selfCheck}
          />
        ) : (
          <EntryCard
            card={card}
            onOpenCorrection={(correctionId) => {
              onOpenCorrection(position, correctionId);
            }}
            selfCheck={selfCheck}
            actions={<EntryActions card={card} />}
          />
        )}
      </PagerScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: {
    position: 'absolute',
    left: space[6],
    right: space[6],
    height: TOP_ROW,
    justifyContent: 'center',
  },
  page: { flex: 1 },
  // A card that fits sits in the middle of the page; a taller one starts at the top.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: TOP_ROW,
    paddingHorizontal: space[6],
    paddingBottom: space[6],
  },
  endOfCycle: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
