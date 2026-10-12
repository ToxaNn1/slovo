import type { FeedCard } from '@slovo/core';
import {
  CardCorners,
  CorrectionCard,
  DecorBackground,
  EndOfCycleCard,
  OrnamentDivider,
  PagerScrollView,
  Placeholder,
  space,
  useTokens,
  VerticalPager,
  WordCard,
  WordOfTheDayBadge,
  type VerticalPagerHandle,
} from '@slovo/ui';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition';
import { useFeed } from '../feed';
import { wordOfTheDayLabel } from '../word-of-the-day';

/** The display name of every Category of the Edition, by id. */
const categoryNames = new Map(edition.categories.map(({ id, displayName }) => [id, displayName]));

/** The Feed's top row, kept for the Stats pill (0.4). */
const TOP_ROW = 48;

/** Home is the Feed: a vertical stream of Entry cards, one per screen. */
export default function HomeScreen() {
  const feed = useFeed();
  const { colors } = useTokens();
  const pager = useRef<VerticalPagerHandle>(null);
  /** The page to turn to once it is drawn, such as a Correction opened from a Word. */
  const [turnTo, setTurnTo] = useState<number>();

  useEffect(() => {
    if (turnTo === undefined) return;
    pager.current?.turnTo(turnTo);
    setTurnTo(undefined);
  }, [turnTo]);

  if (feed.status === 'loading') return null;
  if (feed.status === 'failed') return <Placeholder message={editionStrings.loadFailed} />;
  if (feed.cards.length === 0) return <Placeholder message={editionStrings.noWords} />;

  return (
    <View testID="home" style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The background stays put while the cards move over it. */}
      <DecorBackground />
      <VerticalPager
        ref={pager}
        testID="feed"
        items={feed.cards}
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
        onIndexChange={feed.onCardChange}
      />
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
        <EndOfCycleCard
          title={editionStrings.endOfCycle.title}
          message={editionStrings.endOfCycle.message}
        />
      </View>
    );
  return (
    // The content scrolls under the top row but stops at the status bar.
    <View testID={`feed-card-${String(position)}`} style={[styles.page, { paddingTop: top }]}>
      <PagerScrollView contentContainerStyle={styles.content}>
        {card.kind === 'correction' ? (
          <CorrectionCard
            card={card.correctionCard}
            strings={editionStrings.correctionCard}
            language={edition.locale}
            divider={<OrnamentDivider centre="arrow" />}
          />
        ) : (
          <WordCard
            card={card.wordCard}
            strings={editionStrings.wordCard}
            categoryName={categoryNames.get(card.wordCard.categoryId)}
            language={edition.locale}
            badge={
              card.wordOfTheDay === undefined ? undefined : (
                <WordOfTheDayBadge label={wordOfTheDayLabel(card.wordOfTheDay)} />
              )
            }
            frame={<CardCorners />}
            divider={<OrnamentDivider />}
            onOpenCorrection={onOpenCorrection}
          />
        )}
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
