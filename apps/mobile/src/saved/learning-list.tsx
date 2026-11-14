import { MascotAs } from '@/mascot/mascot';
import { EmptyState, LearningRow, space, useListScroll } from '@slovo/ui';
import { FlatList, StyleSheet } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import type { ListHeader } from '@/saved/list-header';
import { useLearningList } from '@/saved/learning';
import { ListTopButton } from '@/shell/list-top';

const { learning: strings } = editionStrings;

/**
 * The «Вчу» list: every Entry the reader is learning, the next Review first,
 * each row with its meaning and its Review day on a chip (board 09). A tap opens the Entry screen. The list is the
 * Core's own: it has no rename, delete or swipe action, and an Entry leaves it
 * once it is Learned or its mark is removed.
 */
export function LearningList({ header }: { header: ListHeader }) {
  const list = useLearningList();
  const openScreen = useOpenScreen();
  const scroll = useListScroll<FlatList<(typeof list)[number]>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  return (
    <>
      <FlatList
        ref={listRef}
        onScroll={onListScroll}
        testID="learning"
        data={list}
        keyExtractor={(entry) => entry.entryId}
        renderItem={({ item: entry }) => (
          <LearningRow
            entry={entry}
            onPress={() => {
              openScreen(`/saved/learning/${entry.entryId}`);
            }}
          />
        )}
        ListHeaderComponent={header(null)}
        ListEmptyComponent={
          <EmptyState
            mascot={(width) => <MascotAs state="sleeps" width={width} />}
            testID="learning-empty"
            title={strings.empty.title}
            message={strings.empty.message}
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
