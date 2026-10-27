import { dateKeyOf, type WordOfTheDayArchiveDay } from '@slovo/core';
import { BackLink, EmptyState, EntryRow, ScreenTitle, space, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useWordOfTheDayArchive } from '@/saved/word-of-the-day-archive';

const { wordOfTheDayArchive: strings } = editionStrings;

/**
 * «Слова дня»: each day the reader saw the Word of the Day's card, newest
 * first, as «26 жовтня · сумирний»; a Retired Word stays. A tap opens the
 * Entry screen without making it Seen (ADR 0054).
 */
export default function WordOfTheDayArchiveScreen() {
  const days = useWordOfTheDayArchive();
  const { colors } = useTokens();
  const router = useRouter();
  const openScreen = useOpenScreen();

  return (
    <SafeAreaView
      testID="words-of-the-day"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList<WordOfTheDayArchiveDay>
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
        ListHeaderComponent={
          <>
            <View style={styles.bar}>
              <BackLink
                testID="words-of-the-day-back"
                label={editionStrings.tabs.saved}
                onPress={() => {
                  router.back();
                }}
              />
            </View>
            <View style={styles.header}>
              <ScreenTitle>{strings.title}</ScreenTitle>
            </View>
          </>
        }
        ListEmptyComponent={
          days === undefined ? null : (
            <EmptyState
              testID="words-of-the-day-empty"
              title={strings.empty.title}
              message={strings.empty.message}
            />
          )
        }
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  bar: { paddingLeft: space[3], paddingTop: space[2] },
  header: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[2] },
});
