import { localDayOf, type Favorite } from '@slovo/core';
import {
  BackLink,
  EmptyState,
  EntryRow,
  fill,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../../composition';
import { deviceClock } from '../../../device-clock';
import { editionStrings } from '../../../edition';
import { removeFavorite, useFavoriteList, useFavorites } from '../../../favorites';
import { LoadFailed } from '../../../language-pack';

const { favorites: strings } = editionStrings;

/** When the Entry was added, as its row says it: today, yesterday or the date, by the device's clock. */
function addedOn(addedAt: Date): string {
  const { added } = strings;
  const { date, daysAgo } = localDayOf(addedAt, deviceClock);
  if (daysAgo <= 0) return added.today;
  if (daysAgo === 1) return added.yesterday;
  const thisYear = localDayOf(deviceClock.now(), deviceClock).date.year;
  return fill(date.year === thisYear ? added.date : added.dateInYear, {
    day: String(date.day),
    month: added.months[date.month - 1] ?? '',
    year: String(date.year),
  });
}

/**
 * Favorites: every Entry the reader keeps, newest first, each row with when
 * it was added. A tap opens the Entry screen; a swipe (or the VoiceOver
 * action) takes the Entry out. An empty list leads back to the Feed.
 */
export default function FavoritesScreen() {
  const composition = useComposition();
  const favorites = useFavorites();
  const list = useFavoriteList();
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  const router = useRouter();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const ready = composition.status === 'ready';

  function row({ item }: { item: Favorite }) {
    return (
      <EntryRow
        row={item.row}
        trailing={addedOn(item.addedAt)}
        onPress={() => {
          router.push(`/saved/favorites/${item.entryId}`);
        }}
        actions={[
          {
            name: 'remove',
            label: strings.remove,
            accessibilityLabel: fill(strings.removeLabel, { title: item.row.title }),
            tone: 'destructive',
            onPress: () => {
              removeFavorite(favorites, item.entryId);
            },
          },
        ]}
      />
    );
  }

  return (
    <SafeAreaView
      testID="favorites"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <GestureHandlerRootView style={styles.screen}>
        <FlatList
          data={ready ? list : []}
          keyExtractor={(favorite) => favorite.entryId}
          renderItem={row}
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
            ready ? (
              <EmptyState
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
            ) : null
          }
          contentContainerStyle={styles.content}
        />
      </GestureHandlerRootView>
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
    paddingBottom: 14,
  },
  count: { fontSize: 22, fontWeight: '500' },
  footer: {
    marginHorizontal: space[6],
    marginTop: space[4],
    fontSize: 12.5,
    lineHeight: 12.5 * 1.5,
    fontWeight: '500',
  },
});
