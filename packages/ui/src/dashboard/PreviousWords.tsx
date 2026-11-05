import { dateKeyOf, withoutStress, type PreviousWordsBlock } from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { dashboard, pressedFade, previousWordRow, typeStyle } from '../tokens';
import { BlockTitle } from './BlockTitle';

/**
 * «Попередні слова» on the Dashboard (ADR 0076): the archive's newest days
 * before today, each a row of the day over the month's short form, the Lemma
 * over its Definition on one line each, and a chevron. A tap opens the Entry
 * card, which makes nothing Seen.
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
  const { title, months } = strings.dashboard.previousWords;
  return (
    <View testID="dashboard-previous-words">
      <View style={styles.title}>
        <BlockTitle title={title} />
      </View>
      {block.days.map(({ date, dateLabel, row }) => (
        <Pressable
          key={dateKeyOf(date)}
          testID={`dashboard-previous-word-${dateKeyOf(date)}`}
          accessibilityRole="button"
          accessibilityLabel={`${dateLabel}. ${withoutStress(row.title)}. ${row.secondLine}`}
          accessibilityLanguage={voice.accessibilityLanguage}
          onPress={() => {
            onOpen(row.entryId);
          }}
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: colors.line },
            pressed && styles.pressed,
          ]}
        >
          <Text
            {...voice}
            style={[styles.date, typeStyle('previousDate', tokens), { color: colors.muted }]}
          >
            {`${String(date.day)}\n${months[date.month - 1] ?? ''}`}
          </Text>
          <View style={styles.text}>
            <Text
              {...voice}
              numberOfLines={1}
              style={[typeStyle('previousWord', tokens), { color: colors.ink }]}
            >
              {row.title}
            </Text>
            <Text
              {...voice}
              numberOfLines={1}
              style={[typeStyle('previousDefinition', tokens), { color: colors.muted }]}
            >
              {row.secondLine}
            </Text>
          </View>
          <Wedge
            points={previousWordRow.chevron.points}
            color={colors.ink}
            width={previousWordRow.chevron.width}
            height={previousWordRow.chevron.height}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: dashboard.previousTitleGap },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: previousWordRow.gap,
    paddingVertical: previousWordRow.padding,
    borderBottomWidth: previousWordRow.border,
  },
  pressed: { opacity: pressedFade },
  date: { width: previousWordRow.dateWidth },
  text: { flex: 1, minWidth: 0, gap: previousWordRow.textGap },
});
