import {
  fill,
  SavedTabs,
  ScreenTitle,
  SearchLink,
  space,
  useEdition,
  useTokens,
  type SavedTab,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { useCollectionList } from '@/saved/collections';
import { CollectionsList } from '@/saved/collections-list';
import { useFavoriteList } from '@/saved/favorites';
import { FavoritesList } from '@/saved/favorites-list';
import { useHistoryCount } from '@/saved/history';
import { HistoryList } from '@/saved/history-list';
import { useLearningList } from '@/saved/learning';
import { LearningList } from '@/saved/learning-list';
import type { ListHeader } from '@/saved/list-header';
import { useWordOfTheDayArchive } from '@/saved/word-of-the-day-archive';
import { WordOfTheDayArchiveList } from '@/saved/word-of-the-day-archive-list';
import { useShown } from '@/shown-in-effect';
import { useQueryParam } from '@/route-params';

const {
  favorites: favoriteStrings,
  collections: collectionStrings,
  history: historyStrings,
  learning: learningStrings,
  wordOfTheDayArchive: archiveStrings,
} = editionStrings;

type ListId = 'learning' | 'favorites' | 'history' | 'collections' | 'words-of-the-day';

const LISTS = {
  learning: LearningList,
  favorites: FavoritesList,
  history: HistoryList,
  collections: CollectionsList,
  'words-of-the-day': WordOfTheDayArchiveList,
} as const;

/**
 * The Saved tab: its title, a search field that opens Search, and a tab per
 * list with its count: «Вчу» while Knowledge Marks are on in effect,
 * Favorites, History, Collections, and «Слова дня» while the Word of the Day
 * archive is on in effect. The active tab's list shows under them, the first
 * tab's unless the `list` parameter names another; a tap on a tab shows its
 * list in place. Only the list scrolls; the title, search and tabs stay over it.
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
  const router = useRouter();
  const list = useQueryParam('list');

  const tab = (
    id: ListId,
    strings: { title: string; cardLabel: string; count: Parameters<typeof count>[0] },
    total: number,
  ): SavedTab<ListId> => ({
    id,
    label: strings.title,
    count: total,
    accessibilityLabel: fill(strings.cardLabel, { count: count(strings.count, total) }),
  });
  const tabs = [
    ...(learningShown ? [tab('learning', learningStrings, learning.length)] : []),
    tab('favorites', favoriteStrings, favorites.length),
    tab('history', historyStrings, history),
    tab(
      'collections',
      { ...collectionStrings, count: collectionStrings.collectionCount },
      collections.length,
    ),
    ...(archiveShown ? [tab('words-of-the-day', archiveStrings, archive.length)] : []),
  ];
  const active = tabs.find(({ id }) => id === list)?.id ?? tabs[0]?.id ?? 'favorites';
  const List = LISTS[active];

  // Title, search and tabs stay outside the active list, which is drawn afresh
  // for each tab, so the row of tabs keeps where the reader scrolled it.
  const header: ListHeader = (tool) => (
    <>{tool !== null && <View style={styles.tool}>{tool}</View>}</>
  );

  return (
    <SafeAreaView
      testID="saved"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.title}>
        <ScreenTitle>{editionStrings.tabs.saved}</ScreenTitle>
      </View>
      <View style={styles.search}>
        <SearchLink
          testID="saved-search"
          label={editionStrings.search.placeholder}
          onPress={() => {
            openScreen('/search');
          }}
        />
      </View>
      <SavedTabs
        testID="saved"
        tabs={tabs}
        active={active}
        onSelect={(id) => {
          router.setParams({ list: id });
        }}
      />
      <List key={active} header={header} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { paddingHorizontal: space[5], paddingTop: space[6], paddingBottom: space[4] },
  search: { paddingHorizontal: space[5] },
  tool: { alignItems: 'flex-end', paddingHorizontal: space[5] },
});
