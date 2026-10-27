import {
  cardSpace,
  fill,
  LearningCard,
  OrnamentBand,
  SavedCard,
  SavedCardCollection,
  SavedCardCollections,
  SavedCardRows,
  SavedCardTitles,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCollectionList } from '@/saved/collections';
import { editionStrings } from '@/edition/edition';
import { useFavoriteList } from '@/saved/favorites';
import { useHistoryPreview } from '@/saved/history';
import { useLearningList } from '@/saved/learning';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useShown } from '@/shown-in-effect';

const {
  favorites: strings,
  collections: collectionStrings,
  history: historyStrings,
} = editionStrings;

/** How many of the newest Lemmas the Favorites card shows, and of the latest rows the History card. */
const NEWEST_SHOWN = 3;
/** How many of the newest Collections the Collections card shows. */
const NEWEST_COLLECTIONS_SHOWN = 3;

/**
 * The Saved tab's overview: a card per list with its count. Favorites comes
 * first, on the ink fill, with its newest Lemmas and the ornament band
 * (Decor slot 2). Collections follows on the surface with its count and
 * its newest Collections. The «Вчу» card, while Knowledge Marks are on in
 * effect, shows its count and the next Entries due for Review with their
 * days. The History card shows its three latest rows with
 * how long ago each was Seen, and VoiceOver reads the card, rows and times
 * included, in full.
 */
export default function SavedScreen() {
  const favorites = useFavoriteList();
  const collections = useCollectionList();
  const learning = useLearningList();
  const { learning: learningShown } = useShown();
  const history = useHistoryPreview(NEWEST_SHOWN);
  const { colors } = useTokens();
  const { count } = useEdition();
  const openScreen = useOpenScreen();

  return (
    <SafeAreaView
      testID="saved"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle>{editionStrings.tabs.saved}</ScreenTitle>
        <SavedCard
          testID="saved-favorites"
          primary
          title={strings.title}
          count={favorites.length}
          accessibilityLabel={fill(strings.cardLabel, {
            count: count(strings.count, favorites.length),
          })}
          onPress={() => {
            openScreen('/saved/favorites');
          }}
        >
          <SavedCardTitles
            titles={favorites.slice(0, NEWEST_SHOWN).map((favorite) => favorite.row.title)}
          />
          <OrnamentBand />
        </SavedCard>
        <SavedCard
          testID="saved-collections"
          title={collectionStrings.title}
          count={collections.length}
          accessibilityLabel={fill(collectionStrings.cardLabel, {
            count: count(collectionStrings.collectionCount, collections.length),
          })}
          onPress={() => {
            openScreen('/saved/collections');
          }}
        >
          {collections.length > 0 && (
            <SavedCardCollections>
              {collections.slice(0, NEWEST_COLLECTIONS_SHOWN).map((collection) => {
                const entries = count(collectionStrings.count, collection.count);
                return (
                  <SavedCardCollection
                    key={collection.id}
                    testID={`saved-collection-${collection.id}`}
                    name={collection.name}
                    count={entries}
                    accessibilityLabel={fill(collectionStrings.collectionLabel, {
                      name: collection.name,
                      count: entries,
                    })}
                  />
                );
              })}
            </SavedCardCollections>
          )}
        </SavedCard>
        {learningShown && (
          <LearningCard
            entries={learning}
            onPress={() => {
              openScreen('/saved/learning');
            }}
          />
        )}
        <SavedCard
          testID="saved-history"
          title={historyStrings.title}
          count={history.count}
          accessibilityLabel={history.label}
          onPress={() => {
            openScreen('/saved/history');
          }}
        >
          <SavedCardRows rows={history.rows} />
        </SavedCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: cardSpace.gap,
    paddingHorizontal: space[5],
    paddingTop: space[6],
    paddingBottom: space[8],
  },
});
