import {
  Chip,
  CollectionCard,
  collectionCard,
  fill,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCollectionList } from '@/saved/collections';
import { editionStrings } from '@/edition/edition';
import { useFavoriteList } from '@/saved/favorites';
import { useHistoryCount } from '@/saved/history';
import { useLearningList } from '@/saved/learning';
import { useWordOfTheDayArchive } from '@/saved/word-of-the-day-archive';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useShown } from '@/shown-in-effect';

const {
  favorites: favoriteStrings,
  collections: collectionStrings,
  history: historyStrings,
  learning: learningStrings,
  wordOfTheDayArchive: archiveStrings,
} = editionStrings;

/** The Collection cards in rows of two. */
function pairs<T>(items: readonly T[]): (readonly [T, T | undefined])[] {
  const rows: (readonly [T, T | undefined])[] = [];
  items.forEach((item, index) => {
    if (index % 2 === 0) rows.push([item, items[index + 1]]);
  });
  return rows;
}

/**
 * The Saved tab's overview: a chip per list with its count, which opens the
 * list: «Вчу» while Knowledge Marks are on in effect, Favorites, History,
 * Collections, and «Слова дня» while the Word of the Day archive is on in
 * effect. Under them every Collection is a card, two in a row, that opens it.
 */
export default function SavedScreen() {
  const favorites = useFavoriteList();
  const collections = useCollectionList();
  const learning = useLearningList();
  const { learning: learningShown, wordOfTheDayArchive: archiveShown } = useShown();
  const archive = useWordOfTheDayArchive() ?? [];
  const history = useHistoryCount();
  const { colors } = useTokens();
  const { count } = useEdition();
  const openScreen = useOpenScreen();

  const lists = [
    learningShown && {
      id: 'learning',
      strings: learningStrings,
      total: learning.length,
      route: '/saved/learning',
    },
    {
      id: 'favorites',
      strings: favoriteStrings,
      total: favorites.length,
      route: '/saved/favorites',
    },
    { id: 'history', strings: historyStrings, total: history, route: '/saved/history' },
    {
      id: 'collections',
      strings: { ...collectionStrings, count: collectionStrings.collectionCount },
      total: collections.length,
      route: '/saved/collections',
    },
    archiveShown && {
      id: 'words-of-the-day',
      strings: archiveStrings,
      total: archive.length,
      route: '/saved/words-of-the-day',
    },
  ] as const;

  return (
    <SafeAreaView
      testID="saved"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <ScreenTitle>{editionStrings.tabs.saved}</ScreenTitle>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {lists.map(
            (list) =>
              list !== false && (
                <Chip
                  key={list.id}
                  testID={`saved-${list.id}`}
                  label={list.strings.title}
                  count={list.total}
                  accessibilityLabel={fill(list.strings.cardLabel, {
                    count: count(list.strings.count, list.total),
                  })}
                  on={false}
                  onPress={() => {
                    openScreen(list.route);
                  }}
                />
              ),
          )}
        </ScrollView>
        <View style={styles.cards}>
          {pairs(collections).map((pair, row) => (
            <View key={pair[0].id} style={styles.cardRow}>
              {pair.map((collection, place) =>
                collection === undefined ? (
                  <View key="none" style={styles.none} />
                ) : (
                  <CollectionCard
                    key={collection.id}
                    testID={`saved-collection-${collection.id}`}
                    index={row * 2 + place}
                    name={collection.name}
                    count={count(collectionStrings.count, collection.count)}
                    accessibilityLabel={fill(collectionStrings.collectionLabel, {
                      name: collection.name,
                      count: count(collectionStrings.count, collection.count),
                    })}
                    onPress={() => {
                      openScreen(`/saved/collections/${collection.id}`);
                    }}
                  />
                ),
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: space[6], paddingBottom: space[8] },
  title: { paddingHorizontal: space[5] },
  chips: { gap: space[2], paddingHorizontal: space[5], paddingVertical: space[4] },
  cards: { gap: collectionCard.gap, paddingHorizontal: space[5] },
  cardRow: { flexDirection: 'row', gap: collectionCard.gap },
  none: { flex: 1 },
});
