import { relativeTimeOf } from '@slovo/core';
import {
  cardSpace,
  fill,
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

import { useComposition } from '../../composition';
import { useCollectionList } from '../../saved/collections';
import { editionStrings } from '../../edition/edition';
import { deviceClock } from '../../device/device-clock';
import { useFavoriteList } from '../../saved/favorites';
import { useHistoryList, useHistoryText } from '../../saved/history';
import { LoadFailed } from '../../edition/language-pack';
import { useOpenScreen } from '../../entries/use-open-screen';

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
 * its newest Collections. The History card shows its three latest rows with
 * how long ago each was Seen, and VoiceOver reads the card, rows and times
 * included, in full.
 */
export default function SavedScreen() {
  const composition = useComposition();
  const favorites = useFavoriteList();
  const collections = useCollectionList();
  const history = useHistoryList();
  const historyText = useHistoryText();
  const { colors } = useTokens();
  const { count } = useEdition();
  const openScreen = useOpenScreen();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const latest = history.slice(0, NEWEST_SHOWN).map(({ row, seenAt }) => ({
    title: row.title,
    ...historyText.relative(relativeTimeOf(seenAt, deviceClock)),
  }));
  return (
    <SafeAreaView
      testID="saved"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle>{editionStrings.tabs.saved}</ScreenTitle>
        {composition.status === 'ready' && (
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
        )}
        {composition.status === 'ready' && (
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
        )}
        {composition.status === 'ready' && (
          <SavedCard
            testID="saved-history"
            title={historyStrings.title}
            count={history.length}
            accessibilityLabel={historyText.cardLabel(history.length, latest)}
            onPress={() => {
              openScreen('/saved/history');
            }}
          >
            <SavedCardRows rows={latest.map(({ title, text }) => ({ title, trailing: text }))} />
          </SavedCard>
        )}
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
