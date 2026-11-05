import { dateKeyOf, type PreviousWordsBlock } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { EntryRow } from '../entries/EntryRow';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeStyle } from '../tokens';

/**
 * «Попередні слова» on the Dashboard (ADR 0076): the archive's newest days
 * before today, each as «3 листопада · сумирний». A tap opens the Entry card,
 * which makes nothing Seen.
 */
export function PreviousWords({
  block,
  onOpen,
}: {
  block: PreviousWordsBlock;
  onOpen: (entryId: string) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  return (
    <View testID="dashboard-previous-words" style={styles.block}>
      <Text
        accessibilityRole="header"
        {...voice}
        style={[styles.title, typeStyle('rowLabel', tokens), { color: colors.ink }]}
      >
        {strings.dashboard.previousWords.title}
      </Text>
      {block.days.map(({ date, dateLabel, row }) => (
        <EntryRow
          key={dateKeyOf(date)}
          compact
          row={row}
          leading={dateLabel}
          onPress={() => {
            onOpen(row.entryId);
          }}
          testID={`dashboard-previous-word-${dateKeyOf(date)}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[1] },
  title: { paddingHorizontal: space[1] },
});
