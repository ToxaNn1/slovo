import { MascotAs } from '@/mascot/mascot';
import { dateKeyOf, todayDate, type WordOfTheDayArchiveDay } from '@slovo/core';
import { EmptyState, EntryRow, space, useListScroll } from '@slovo/ui';
import { FlatList, StyleSheet } from 'react-native';

import { deviceClock } from '@/device/device-clock';
import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import type { ListHeader } from '@/saved/list-header';
import { useWordOfTheDayArchive } from '@/saved/word-of-the-day-archive';
import { ListTopButton } from '@/shell/list-top';

const { wordOfTheDayArchive: strings } = editionStrings;

/**
 * «Слова дня» (board 09): each day the reader saw the Word of the Day's card,
 * newest first, the Word with its meaning and the day («26 жовтня») on a
 * chip, today's marked; a Retired Word stays. A tap opens the Entry screen
 * without making it Seen.
 */
export function WordOfTheDayArchiveList({ header }: { header: ListHeader }) {
  const days = useWordOfTheDayArchive();
  const openScreen = useOpenScreen();
  const today = dateKeyOf(todayDate(deviceClock));
  const scroll = useListScroll<FlatList<WordOfTheDayArchiveDay>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  return (
    <>
      <FlatList<WordOfTheDayArchiveDay>
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        ref={listRef}
        onScroll={onListScroll}
        testID="words-of-the-day"
        data={days}
        keyExtractor={({ date }) => dateKeyOf(date)}
        renderItem={({ item }) => (
          <EntryRow
            row={item.row}
            day={{ label: item.dateLabel, today: dateKeyOf(item.date) === today }}
            onPress={() => {
              openScreen(`/saved/words-of-the-day/${item.row.entryId}`);
            }}
            testID={`words-of-the-day-row-${dateKeyOf(item.date)}`}
          />
        )}
        ListHeaderComponent={header(null)}
        ListEmptyComponent={
          <EmptyState
            mascot={(width) => <MascotAs state="sleeps" width={width} />}
            testID="words-of-the-day-empty"
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
