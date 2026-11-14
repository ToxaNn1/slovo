import { MascotAs } from '@/mascot/mascot';
import { withoutStress, type Favorite } from '@slovo/core';
import { EmptyState, EntryRow, fill, space, useListScroll } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { dayChip } from '@/saved/added-on';
import { useFavorite, useFavoriteList } from '@/saved/favorites';
import type { ListHeader } from '@/saved/list-header';
import { ListTopButton } from '@/shell/list-top';

const { favorites: strings } = editionStrings;

/** A row of Favorites: a tap opens the Entry screen, the swipe action takes the Entry out. */
function FavoriteRow({ favorite: { entryId, row, addedAt } }: { favorite: Favorite }) {
  const { remove } = useFavorite(entryId);
  const openScreen = useOpenScreen();
  return (
    <EntryRow
      row={row}
      day={dayChip(addedAt)}
      onPress={() => {
        openScreen(`/saved/favorites/${entryId}`);
      }}
      actions={[
        {
          name: 'remove',
          label: strings.remove,
          accessibilityLabel: fill(strings.removeLabel, { title: withoutStress(row.title) }),
          tone: 'destructive',
          onPress: remove,
        },
      ]}
    />
  );
}

/**
 * Favorites (board 09): every Entry the reader keeps, newest first, each row
 * with its meaning and the day it was added on a chip. A tap opens the
 * Entry screen; a swipe (or the VoiceOver action) takes the Entry out. An
 * empty list leads back to the Feed.
 */
export function FavoritesList({ header }: { header: ListHeader }) {
  const list = useFavoriteList();
  const router = useRouter();
  const scroll = useListScroll<FlatList<Favorite>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  return (
    <>
      <FlatList
        ref={listRef}
        onScroll={onListScroll}
        testID="favorites"
        data={list}
        keyExtractor={(favorite) => favorite.entryId}
        renderItem={({ item }) => <FavoriteRow favorite={item} />}
        ListHeaderComponent={header(null)}
        ListEmptyComponent={
          <EmptyState
            mascot={(width) => <MascotAs state="sleeps" width={width} />}
            testID="favorites-empty"
            title={strings.empty.title}
            message={strings.empty.message}
            action={{
              label: strings.empty.toFeed,
              testID: 'favorites-to-feed',
              onPress: () => {
                router.navigate('/');
              },
            }}
          />
        }
        contentContainerStyle={styles.content}
      />
      <ListTopButton scroll={scroll} overTabBar />
    </>
  );
}

const styles = StyleSheet.create({
  // The list grows to the screen, so an empty state sits in the middle of it.
  content: { flexGrow: 1, paddingBottom: space[8] },
});
