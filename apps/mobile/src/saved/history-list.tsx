import { MascotIn } from '@/mascot/mascot';
import {
  ClearHistoryButton,
  EmptyState,
  EntryRow,
  SectionLabel,
  space,
  useTokens,
} from '@slovo/ui';
import { SectionList, StyleSheet } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { useClearHistory, useHistorySections } from '@/saved/history';
import type { HistoryEntryModel, HistorySection } from '@/saved/history-screen';
import type { ListHeader } from '@/saved/list-header';

const { history: strings } = editionStrings;

/**
 * History: the Entries the reader has Seen, newest first, grouped under the
 * day they were Seen («СЬОГОДНІ», «УЧОРА», then dates), each row saying
 * whether it was a Word, a Correction or the Word of the Day. A tap opens the
 * Entry screen without making it Seen again. Its tool, «Очистити», asks
 * first, with the SLOVO confirmation dialog, and clears History only.
 */
export function HistoryList({ header }: { header: ListHeader }) {
  const sections = useHistorySections();
  const clear = useClearHistory();
  const { colors } = useTokens();
  const openScreen = useOpenScreen();

  return (
    <SectionList<HistoryEntryModel, HistorySection>
      testID="history"
      sections={sections}
      keyExtractor={(entry) => entry.entryId}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <SectionLabel style={[styles.day, { color: colors.accent }]}>{section.title}</SectionLabel>
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
      ListHeaderComponent={header(
        sections.length > 0 ? (
          <ClearHistoryButton testID="history-clear" copy={strings.clear} onClear={clear} />
        ) : null,
      )}
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
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  day: { paddingHorizontal: space[6], paddingTop: space[5], paddingBottom: space[1] },
});
