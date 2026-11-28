import { MascotAs } from '@/mascot/mascot';
import { ClearHistoryButton, EmptyState, EntryRow, space, useListScroll } from '@slovo/ui';
import { FlatList, StyleSheet } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenEntry } from '@/entry-ahead';
import { useClearHistory, useHistoryRows, type HistoryRow } from '@/saved/history';
import type { ListHeader } from '@/saved/list-header';
import { ListTopButton } from '@/shell/list-top';

const { history: strings } = editionStrings;

/**
 * History (board 09): the Entries the reader has Seen in one list, newest
 * first, each row with its meaning and the day it was Seen on a chip. A tap
 * opens the Entry screen without making it Seen again. Its tool, «Очистити»,
 * asks first, with the SLOVO confirmation dialog, and clears History only.
 */
export function HistoryList({ header }: { header: ListHeader }) {
  const rows = useHistoryRows();
  const clear = useClearHistory();
  const openEntry = useOpenEntry();
  const scroll = useListScroll<FlatList<HistoryRow>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  return (
    <>
      <FlatList<HistoryRow>
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ref={listRef}
        onScroll={onListScroll}
        testID="history"
        data={rows}
        keyExtractor={(entry) => entry.entryId}
        // History holds up to its cap of rows: draw about three screens around the
        // visible one, a few rows a frame, in place of the default ten screens.
        windowSize={7}
        maxToRenderPerBatch={8}
        renderItem={({ item }) => (
          <EntryRow
            row={item.row}
            day={item.day}
            onPress={() => {
              openEntry(item.entryId, `/saved/history/${item.entryId}`);
            }}
            testID={`history-row-${item.entryId}`}
          />
        )}
        ListHeaderComponent={header(
          rows.length > 0 ? (
            <ClearHistoryButton testID="history-clear" copy={strings.clear} onClear={clear} />
          ) : null,
        )}
        ListEmptyComponent={
          <EmptyState
            mascot={(width) => <MascotAs state="sleeps" width={width} />}
            testID="history-empty"
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
