import { MascotIn } from '@/mascot/mascot';
import { withoutStress, type Favorite } from '@slovo/core';
import {
  BackLink,
  EmptyState,
  EntryRow,
  fill,
  rowPadding,
  ScreenTitle,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { entryLabelBeside } from '@slovo/ui/entry-row-text';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addedOn } from '@/saved/added-on';
import { editionStrings } from '@/edition/edition';
import { useFavorite, useFavoriteList } from '@/saved/favorites';
import { useOpenScreen } from '@/entries/use-open-screen';

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
 * it was added, a Synonym Row's and a Tip's with its kind too. A tap opens the Entry screen; a swipe (or the VoiceOver
 * action) takes the Entry out. An empty list leads back to the Feed.
 */
export default function FavoritesScreen() {
  const list = useFavoriteList();
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  const router = useRouter();

  return (
    <SafeAreaView
      testID="favorites"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList
        data={list}
        keyExtractor={(favorite) => favorite.entryId}
        renderItem={({ item }) => <FavoriteRow favorite={item} />}
        ListHeaderComponent={
          <>
            <View style={styles.back}>
              <BackLink
                testID="favorites-back"
                label={editionStrings.tabs.saved}
                onPress={() => {
                  router.back();
                }}
              />
            </View>
            <View
              style={[
                styles.header,
                list.length > 0 && { borderBottomWidth: 1, borderColor: colors.line },
              ]}
            >
              <ScreenTitle>{strings.title}</ScreenTitle>
              <Text
                testID="favorites-count"
                accessibilityLabel={count(strings.count, list.length)}
                {...voice}
                style={[styles.count, { color: colors.accent, fontFamily: fontFamilies.word }]}
              >
                {String(list.length)}
              </Text>
            </View>
          </>
        }
        ListFooterComponent={
          list.length > 0 ? (
            <Text
              {...voice}
              style={[styles.footer, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {strings.footer}
            </Text>
          ) : null
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[6],
    paddingTop: space[2],
    paddingBottom: rowPadding,
  },
  count: { fontSize: typeSize.subhead, fontWeight: '500' },
  footer: {
    marginHorizontal: space[6],
    marginTop: space[4],
    fontSize: typeSize.chip,
    lineHeight: typeSize.chip * 1.5,
    fontWeight: '500',
  },
});
