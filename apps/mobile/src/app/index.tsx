import { renderStress, type FeedCard } from '@slovo/core';
import {
  CardCorners,
  DecorBackground,
  OrnamentDivider,
  Placeholder,
  space,
  useTokens,
  VerticalPager,
  WordCard,
} from '@slovo/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from '../edition';
import { useFeed } from '../feed';

/** The Feed's top row, kept for the Stats pill (0.4). */
const TOP_ROW = 48;

/** Home is the Feed: a vertical stream of Entry cards, one per screen. */
export default function HomeScreen() {
  const feed = useFeed();
  const { colors } = useTokens();

  if (feed.status === 'loading') return null;
  if (feed.status === 'failed') return <Placeholder message={editionStrings.loadFailed} />;
  if (feed.cards.length === 0) return <Placeholder message={editionStrings.noWords} />;

  return (
    <View testID="home" style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* The background stays put while the cards move over it. */}
      <DecorBackground />
      <VerticalPager
        testID="feed"
        items={feed.cards}
        renderPage={(card, position) => <FeedPage card={card} position={position} />}
        onIndexChange={feed.onCardChange}
      />
    </View>
  );
}

function FeedPage({ card, position }: { card: FeedCard; position: number }) {
  const { top } = useSafeAreaInsets();
  const { entry } = card;
  return (
    <View
      testID={`feed-card-${String(position)}`}
      style={[styles.page, { paddingTop: top + TOP_ROW }]}
    >
      {entry.kind === 'word' ? (
        <WordCard
          lemma={renderStress(entry)}
          partOfSpeech={editionStrings.partsOfSpeech[entry.partOfSpeech]}
          primaryDefinition={entry.primaryDefinition}
          frame={<CardCorners />}
          divider={<OrnamentDivider />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { flex: 1, paddingHorizontal: space[6], paddingBottom: space[6], overflow: 'hidden' },
});
