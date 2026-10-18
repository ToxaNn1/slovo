import { entryIdOf, type FeedCard } from '@slovo/core';
import {
  DecorBackground,
  EndOfCycleCard,
  EntryCard,
  Placeholder,
  space,
  SwipeHint,
  UndoToastProvider,
  useTokens,
  VerticalPager,
  type VerticalPagerHandle,
} from '@slovo/ui';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '../edition/edition';
import { EntryActions } from '../entries/entry-actions';
import { useFeed } from '../feed/feed';
import { TOP_ROW } from '../edition/feed-loading';
import { StatsPillAndSheet } from '../progress';
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
  const feed = useFeed();
  const swipeHint = useSwipeHint();
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  const pager = useRef<VerticalPagerHandle>(null);
  /** The page to turn to once it is drawn, such as a Correction opened from a Word. */
  const [turnTo, setTurnTo] = useState<number>();

  useEffect(() => {
    if (turnTo === undefined) return;
    pager.current?.turnTo(turnTo);
    setTurnTo(undefined);
  }, [turnTo]);

  const { cards, readerPosition, onCardChange, openLinkedCorrection } = feed;
  const { dismiss: dismissSwipeHint } = swipeHint;
  // A hide or its undo drops or puts back cards, and the reader's card moves
  // with them: the pager shows it at once. When the Feed has no card to put
  // after a hidden one, the pager stays on its page.
  useEffect(() => {
    const position = readerPosition();
    if (position >= cards.length) return;
    pager.current?.showPage(position);
    onCardChange(position);
  }, [cards, readerPosition, onCardChange]);

  // Kept from render to render: a swipe re-renders the pager, and its pages
  // re-render only when their card changes.
  const openCorrection = useCallback(
    (position: number, correctionId: string) => {
      openLinkedCorrection(position, correctionId).then(setTurnTo, (error: unknown) => {
        console.error('Could not open the linked Correction', error);
      });
    },
    [openLinkedCorrection],
  );
  const renderPage = useCallback(
    (card: FeedCard, position: number) => (
      <FeedPage
        // A card that takes the place of a hidden one starts afresh, scrolled to its top.
        key={entryIdOf(card) ?? card.kind}
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
    // The page itself never scrolls: a long card's text scrolls inside the card.
    <View
      testID={`feed-card-${String(position)}`}
      style={[styles.page, styles.content, { paddingTop: top + TOP_ROW }]}
    >
      <EntryCard
        scrollable
        card={card}
        onOpenCorrection={(correctionId) => {
          onOpenCorrection(position, correctionId);
        }}
        actions={<EntryActions card={card} />}
      />
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
  content: { paddingHorizontal: space[6], paddingBottom: space[6] },
  endOfCycle: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
