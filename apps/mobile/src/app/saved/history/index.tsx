import { MascotIn } from '@/mascot/mascot';
import { HISTORY_CAP } from '@slovo/core';
import {
  BackLink,
  ClearHistoryButton,
  EmptyState,
  EntryRow,
  fill,
  ScreenTitle,
  SectionLabel,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useClearHistory, useHistorySections } from '@/saved/history';
import type { HistoryEntryModel, HistorySection } from '@/saved/history-screen';

const { history: strings } = editionStrings;

/**
 * History: the Entries the reader has Seen, newest first, grouped under the
 * day they were Seen («СЬОГОДНІ», «УЧОРА», then dates), each row saying
 * whether it was a Word, a Correction or the Word of the Day. A tap opens the
 * Entry screen without making it Seen again. «Очистити» asks first, with the
 * SLOVO confirmation dialog, and clears History only.
 */
export default function HistoryScreen() {
  const sections = useHistorySections();
  const clear = useClearHistory();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();
  const openScreen = useOpenScreen();

  return (
    <SafeAreaView
      testID="history"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <SectionList<HistoryEntryModel, HistorySection>
        sections={sections}
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
            trailing={item.label}
            onPress={() => {
              openScreen(`/saved/history/${item.entryId}`);
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
              {sections.length > 0 && (
                <ClearHistoryButton testID="history-clear" copy={strings.clear} onClear={clear} />
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
          <EmptyState
            mascot={<MascotIn state="empty" />}
            testID="history-empty"
            title={strings.empty.title}
            message={strings.empty.message}
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space[3],
    paddingRight: space[6],
    paddingTop: space[2],
  },
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
  limit: { fontSize: typeSize.caption, fontWeight: '500' },
  day: { paddingHorizontal: space[6], paddingTop: space[5], paddingBottom: space[1] },
});
