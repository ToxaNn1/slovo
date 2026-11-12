'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import {
  dateKeyOf,
  withoutStress,
  type PreviousWordsBlock,
  type WordOfTheDayArchiveDay,
} from '@slovo/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useCascade } from '../primitives/useCascade';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { dashboard, pressedFade, previousWordRow, typeStyle } from '../tokens';
import { BlockTitle } from './BlockTitle';

/**
 * «Минулі Слова дня» on the Dashboard (ADR 0076): the archive's newest days
 * before today, each a row of the day over the month's short form, the Lemma
 * over its Definition on one line each, and a chevron, rising in one after
 * another (ADR 0105). A tap opens the Entry card, which makes nothing Seen.
 */
export function PreviousWords({
  block,
  onOpen,
}: {
  block: PreviousWordsBlock;
  onOpen: (entryId: string) => void;
}) {
  const { strings } = useEdition();
  return (
    <View testID="dashboard-previous-words">
      <View style={styles.title}>
        <BlockTitle title={strings.dashboard.previousWords.title} />
      </View>
      {block.days.map((day, index) => (
        <PreviousWordRow key={dateKeyOf(day.date)} day={day} index={index} onOpen={onOpen} />
      ))}
    </View>
  );
}

/** One day of the archive, rising in after the `index` rows above it. */
function PreviousWordRow({
  day: { date, dateLabel, row },
  index,
  onOpen,
}: {
  day: WordOfTheDayArchiveDay;
  index: number;
  onOpen: (entryId: string) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { months } = strings.dashboard.previousWords;
  // The board starts each Lemma with a capital, in the Edition's language.
  const [first = '', ...rest] = Array.from(row.title);
  const lemma = first.toLocaleUpperCase(voice.accessibilityLanguage) + rest.join('');
  const rise = useCascade(index, { variant: 'rise', ...previousWordRow.cascade });
  return (
    <Animated.View style={rise}>
      <Pressable
        testID={`dashboard-previous-word-${dateKeyOf(date)}`}
        accessibilityRole="button"
        accessibilityLabel={`${dateLabel}. ${withoutStress(lemma)}. ${row.secondLine}`}
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
            {lemma}
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
    </Animated.View>
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
