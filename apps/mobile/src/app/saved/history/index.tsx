import { groupByLocalDay, HISTORY_CAP, type HistoryEntry } from '@slovo/core';
import {
  BackLink,
  EmptyState,
  EntryRow,
  fill,
  ScreenTitle,
  SectionLabel,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../../composition';
import { deviceClock } from '../../../device-clock';
import { editionStrings } from '../../../edition';
import { useClearHistory, useHistoryList, useHistoryText } from '../../../history';
import { LoadFailed } from '../../../language-pack';

const { history: strings } = editionStrings;

/**
 * History: the Entries the reader has Seen, newest first, grouped under the
 * day they were Seen («СЬОГОДНІ», «УЧОРА», then dates), each row saying
 * whether it was a Word, a Correction or the Word of the Day. A tap opens the
 * Entry screen without making it Seen again. «Очистити» asks first, with a
 * system alert, and clears History only.
 */
export default function HistoryScreen() {
  const composition = useComposition();
  const list = useHistoryList();
  const clear = useClearHistory();
  const text = useHistoryText();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();
  const sections = useMemo(
    () =>
      groupByLocalDay(list, ({ seenAt }) => seenAt, deviceClock).map(({ day, entries }) => ({
        key: `${String(day.date.year)}-${String(day.date.month)}-${String(day.date.day)}`,
        title: text.dayHeading(day),
        data: entries,
      })),
    [list, text],
  );

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const ready = composition.status === 'ready';

  function confirmClear() {
    Alert.alert(strings.clear.title, strings.clear.message, [
      { text: strings.clear.cancel, style: 'cancel' },
      { text: strings.clear.confirm, style: 'destructive', onPress: clear },
    ]);
  }

  return (
    <SafeAreaView
      testID="history"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <GestureHandlerRootView style={styles.screen}>
        <SectionList<HistoryEntry, { key: string; title: string; data: readonly HistoryEntry[] }>
          sections={ready ? sections : []}
          keyExtractor={(entry) => entry.entryId}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <SectionLabel style={[styles.day, { color: colors.accent }]}>
              {section.title}
            </SectionLabel>
          )}
          renderItem={({ item }) => (
            <EntryRow
              compact
              row={item.row}
              trailing={text.kind(item)}
              onPress={() => {
                router.push(`/saved/history/${item.entryId}`);
              }}
              testID={`history-row-${item.entryId}`}
            />
          )}
          ListHeaderComponent={
            <>
              <View style={styles.bar}>
                <BackLink
                  testID="history-back"
                  label={editionStrings.tabs.saved}
                  onPress={() => {
                    router.back();
                  }}
                />
                {list.length > 0 && (
                  <Pressable
                    testID="history-clear"
                    accessibilityRole="button"
                    {...voice}
                    onPress={confirmClear}
                    style={styles.clear}
                  >
                    <Text
                      style={[styles.clearText, { color: colors.ink, fontFamily: fontFamilies.ui }]}
                    >
                      {strings.clear.action}
                    </Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.header}>
                <ScreenTitle>{strings.title}</ScreenTitle>
                <Text
                  testID="history-limit"
                  {...voice}
                  style={[styles.limit, { color: colors.muted, fontFamily: fontFamilies.ui }]}
                >
                  {fill(strings.limit, { count: String(HISTORY_CAP) })}
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            ready ? (
              <EmptyState
                testID="history-empty"
                title={strings.empty.title}
                message={strings.empty.message}
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space[3],
    paddingRight: space[6],
    paddingTop: space[2],
  },
  clear: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  clearText: { fontSize: 17, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space[3],
    paddingHorizontal: space[6],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  limit: { fontSize: 14, fontWeight: '500' },
  day: { paddingHorizontal: space[6], paddingTop: space[5], paddingBottom: space[1] },
});
