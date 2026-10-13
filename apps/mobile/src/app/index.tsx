import { entryIdOf, type FeedCard } from '@slovo/core';
import {
  DecorBackground,
  EndOfCycleCard,
  EntryCard,
  PagerScrollView,
  Placeholder,
  space,
  SwipeHint,
  useTokens,
  VerticalPager,
  type VerticalPagerHandle,
} from '@slovo/ui';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '../edition';
import { EntryActions } from '../entry-actions';
import { useFeed } from '../feed';
import { FeedLoadingScreen, TOP_ROW } from '../feed-loading';
import { LoadFailed } from '../language-pack';
import { useSwipeHint } from '../swipe-hint';

const { feed: feedStrings } = editionStrings;

/** Home is the Feed: a vertical stream of Entry cards, one per screen. */
export default function HomeScreen() {
  const feed = useFeed();
  const swipeHint = useSwipeHint();
  const { colors } = useTokens();
  const pager = useRef<VerticalPagerHandle>(null);
  /** The page to turn to once it is drawn, such as a Correction opened from a Word. */
  const [turnTo, setTurnTo] = useState<number>();

  useEffect(() => {
    if (turnTo === undefined) return;
    pager.current?.turnTo(turnTo);
    setTurnTo(undefined);
  }, [turnTo]);

  if (feed.status === 'loading') return <FeedLoadingScreen />;
  if (feed.status === 'failed') return <LoadFailed onRetry={feed.retry} />;
  if (feed.cards.length === 0) return <Placeholder message={editionStrings.noWords} />;

  return (
    <View testID="home" style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The background stays put while the cards move over it. */}
      <DecorBackground />
      <VerticalPager
        ref={pager}
        testID="feed"
        items={feed.cards}
        initialIndex={feed.startPosition}
        renderPage={(card, position) => (
          <FeedPage
            card={card}
            position={position}
            onOpenCorrection={(correctionId) => {
              feed
                .openLinkedCorrection(position, correctionId)
                .then(setTurnTo, (error: unknown) => {
                  console.error('Could not open the linked Correction', error);
                });
            }}
          />
        )}
        onIndexChange={(position) => {
          feed.onCardChange(position);
          swipeHint.dismiss();
        }}
        turnActionLabels={{ next: feedStrings.nextEntry, previous: feedStrings.previousEntry }}
      />
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

function FeedPage({
  card,
  position,
  onOpenCorrection,
}: {
  card: FeedCard;
  position: number;
  onOpenCorrection: (correctionId: string) => void;
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
    // The content scrolls under the top row but stops at the status bar.
    <View testID={`feed-card-${String(position)}`} style={[styles.page, { paddingTop: top }]}>
      <PagerScrollView contentContainerStyle={styles.content}>
        <EntryCard
          card={card}
          onOpenCorrection={onOpenCorrection}
          actions={<EntryActions entryId={entryIdOf(card)} />}
        />
      </PagerScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flex: 1 },
  content: { paddingTop: TOP_ROW, paddingHorizontal: space[6], paddingBottom: space[6] },
  endOfCycle: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
