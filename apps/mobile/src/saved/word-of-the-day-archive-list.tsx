import { MascotIn } from '@/mascot/mascot';
import { dateKeyOf, type WordOfTheDayArchiveDay } from '@slovo/core';
import { EmptyState, EntryRow, space } from '@slovo/ui';
import { FlatList, StyleSheet } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import type { ListHeader } from '@/saved/list-header';
import { useWordOfTheDayArchive } from '@/saved/word-of-the-day-archive';

const { wordOfTheDayArchive: strings } = editionStrings;

/**
 * «Слова дня»: each day the reader saw the Word of the Day's card, newest
 * first, as «26 жовтня · сумирний»; a Retired Word stays. A tap opens the
 * Entry screen without making it Seen (ADR 0054).
 */
export function WordOfTheDayArchiveList({ header }: { header: ListHeader }) {
  const days = useWordOfTheDayArchive();
  const openScreen = useOpenScreen();

  return (
    <FlatList<WordOfTheDayArchiveDay>
      testID="words-of-the-day"
      data={days}
      keyExtractor={({ date }) => dateKeyOf(date)}
      renderItem={({ item }) => (
        <EntryRow
          compact
          row={item.row}
          leading={item.dateLabel}
          onPress={() => {
            openScreen(`/saved/words-of-the-day/${item.row.entryId}`);
          }}
          testID={`words-of-the-day-row-${dateKeyOf(item.date)}`}
        />
      )}
      ListHeaderComponent={header(null)}
      ListEmptyComponent={
        days === undefined ? null : (
          <EmptyState
            mascot={<MascotIn state="empty" />}
            testID="words-of-the-day-empty"
            title={strings.empty.title}
            message={strings.empty.message}
          />
        )
      }
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
});
