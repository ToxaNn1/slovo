import { fill } from '@slovo/contracts';
import type { CuratedCollectionEntry } from '@slovo/core';
import {
  categoryTile,
  CuratedCollectionRow,
  railScreen,
  RailScreenHero,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { useCuratedCollectionScreen } from '@/dashboard/curated-collection';
import { editionStrings } from '@/edition/edition';

const { curatedCollection: words, curatedCollectionCount } = editionStrings.dashboard;

/**
 * A Curated Collection's screen, from its card on the Dashboard, as the
 * board's «cat» screen draws it: the red hero with «Додати», its Entries as
 * cards under it. An id with no screen returns home.
 */
export default function CuratedCollectionRoute() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const { screen, place, add, openEntry } = useCuratedCollectionScreen(collectionId);
  const { colors } = useTokens();
  const { count } = useEdition();
  const router = useRouter();
  if (screen === null) return <Redirect href="/" />;
  const [glyph] = categoryTile.shapes[place % categoryTile.shapes.length] ?? categoryTile.shapes[0];
  return (
    <View
      testID="curated-collection"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList<CuratedCollectionEntry>
        data={screen?.entries ?? []}
        keyExtractor={({ entryId }) => entryId}
        renderItem={({ item: { entryId, row, known } }) => (
          <CuratedCollectionRow
            testID={`curated-collection-entry-${entryId}`}
            row={row}
            known={known}
            onPress={() => {
              openEntry(entryId);
            }}
          />
        )}
        ListHeaderComponent={
          <RailScreenHero
            id="curated-collection-hero"
            glyph={glyph}
            kicker={fill(words.kicker, {
              count: count(curatedCollectionCount, screen?.total ?? 0),
            })}
            title={screen?.collection.name ?? ''}
            description={screen?.collection.description ?? ''}
            progress={fill(words.known, {
              x: String(screen?.known ?? 0),
              n: String(screen?.total ?? 0),
            })}
            done={screen === undefined || screen.total === 0 ? 0 : screen.known / screen.total}
            mascot="waits"
            back={{
              testID: 'curated-collection-back',
              label: editionStrings.tabs.home,
              onPress: () => {
                router.back();
              },
            }}
            {...(screen !== undefined && {
              add: {
                testID: 'curated-collection-add',
                label: screen.added ? words.addedButton : words.addButton,
                added: screen.added,
                onPress: () => {
                  if (!screen.added) add();
                },
              },
            })}
          />
        }
        ListHeaderComponentStyle={styles.hero}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { marginHorizontal: -railScreen.list.side, marginBottom: railScreen.list.top },
  content: { paddingHorizontal: railScreen.list.side, paddingBottom: railScreen.list.bottom },
  gap: { height: railScreen.list.wordGap },
});
