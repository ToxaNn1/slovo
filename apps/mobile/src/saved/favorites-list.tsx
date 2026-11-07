import { MascotIn } from '@/mascot/mascot';
import { withoutStress, type Favorite } from '@slovo/core';
import { EmptyState, EntryRow, fill, space, typeStyle, useEdition, useTokens } from '@slovo/ui';
import { entryLabelBeside } from '@slovo/ui/entry-row-text';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { addedOn } from '@/saved/added-on';
import { useFavorite, useFavoriteList } from '@/saved/favorites';
import type { ListHeader } from '@/saved/list-header';

const { favorites: strings } = editionStrings;

/** A row of Favorites: a tap opens the Entry screen, the swipe action takes the Entry out. */
function FavoriteRow({ favorite: { entryId, row, addedAt } }: { favorite: Favorite }) {
  const { remove } = useFavorite(entryId);
  const openScreen = useOpenScreen();
  return (
    <EntryRow
      row={row}
      trailing={entryLabelBeside(editionStrings.history, row, addedOn(addedAt))}
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
 * Favorites: every Entry the reader keeps, newest first, each row with when
 * it was added, a Synonym Row's and a Tip's with its kind too. A tap opens the
 * Entry screen; a swipe (or the VoiceOver action) takes the Entry out. An
 * empty list leads back to the Feed.
 */
export function FavoritesList({ header }: { header: ListHeader }) {
  const list = useFavoriteList();
  const tokens = useTokens();
  const { voice } = useEdition();
  const router = useRouter();

  return (
    <FlatList
      testID="favorites"
      data={list}
      keyExtractor={(favorite) => favorite.entryId}
      renderItem={({ item }) => <FavoriteRow favorite={item} />}
      ListHeaderComponent={header(null)}
      ListFooterComponent={
        list.length > 0 ? (
          <Text
            {...voice}
            style={[typeStyle('meta', tokens), styles.footer, { color: tokens.colors.muted }]}
          >
            {strings.footer}
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          mascot={<MascotIn state="empty" />}
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
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  footer: { marginHorizontal: space[6], marginTop: space[4] },
});
