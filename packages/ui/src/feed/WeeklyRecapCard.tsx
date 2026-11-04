import type { Plural } from '@slovo/contracts';
import type { WeeklyRecapModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { noticeCard, typeStyle } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/** How far a number grows with the text size, so four of them still fit the card. */
const NUMBER_MAX_FONT_SCALE = 1.5;

/**
 * The Weekly Recap card «Твій тиждень» in the Feed Notice frame: the past
 * week's Entries Seen, Favorites added and Known marks, and the current
 * Streak, then the week's XP and goal days, each on a tile three to a row,
 * the Streak's tile red (ADR 0054).
 * The Known number, the XP and the goal days are left out when the recap has
 * none, and the Streak while the reader hides it. «Поділитися»
 * under the numbers opens the recap's Share Card, when sharing is there.
 * Until its numbers are read the card shows its title alone.
 */
export function WeeklyRecapCard({
  recap,
  hideStreak = false,
  onShare,
}: {
  recap: WeeklyRecapModel | undefined;
  hideStreak?: boolean;
  /** Opens the share sheet with the recap's Share Card; without it, no «Поділитися». */
  onShare?: (() => void) | undefined;
}) {
  const { strings } = useEdition();
  const words = strings.feedNotices.weeklyRecap;
  const numbers =
    recap === undefined
      ? []
      : (
          [
            { key: 'seen', value: recap.seen },
            { key: 'saved', value: recap.saved },
            { key: 'known', value: recap.known },
            { key: 'streak', value: hideStreak ? undefined : recap.streak },
            { key: 'xp', value: recap.xp },
            { key: 'goalDays', value: recap.goalDays },
          ] as const
        ).flatMap(({ key, value }) =>
          value === undefined ? [] : [{ key, value, label: words[key], spoken: words.spoken[key] }],
        );
  return (
    <FeedNoticeCard
      notice="weeklyRecap"
      title={words.title}
      action={
        recap === undefined || onShare === undefined
          ? undefined
          : { variant: 'onAccent', label: strings.share.share, onPress: onShare }
      }
    >
      {numbers.length > 0 && (
        <View style={styles.grid}>
          {rowsOf(numbers, noticeCard.recap.columns).map((row) => (
            <View key={row.map(({ key }) => key).join()} style={styles.row}>
              {row.map(({ key, value, label, spoken }) => (
                <RecapNumber
                  key={key}
                  testID={`weekly-recap-${key}`}
                  value={value}
                  label={label}
                  spoken={spoken}
                  marked={key === 'streak'}
                />
              ))}
              {Array.from({ length: noticeCard.recap.columns - row.length }, (_, gap) => (
                <View key={`gap-${String(gap)}`} style={styles.tile} />
              ))}
            </View>
          ))}
        </View>
      )}
    </FeedNoticeCard>
  );
}

/** The items in rows of `columns`, the last row possibly shorter. */
function rowsOf<Item>(items: readonly Item[], columns: number): Item[][] {
  return Array.from({ length: Math.ceil(items.length / columns) }, (_, row) =>
    items.slice(row * columns, (row + 1) * columns),
  );
}

function RecapNumber({
  value,
  label,
  spoken,
  testID,
  marked,
}: {
  value: number;
  label: string;
  /** What VoiceOver reads for the number, in the Edition's plural forms. */
  spoken: Plural;
  testID: string;
  /** The Streak's tile: red, with the key ink. */
  marked: boolean;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice, count } = useEdition();
  const ink = marked ? keyInk : colors.ink;
  return (
    // VoiceOver reads the number and its label as one element, in the Edition's words.
    <View
      testID={testID}
      accessible
      accessibilityLabel={count(spoken, value)}
      {...voice}
      style={[
        styles.tile,
        styles.number,
        {
          borderRadius: radii.tile,
          backgroundColor: marked ? colors.accent : colors.surfaceSunken,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[typeStyle('recapNumber', tokens), { color: ink }]}
      >
        {value}
      </Text>
      <Text
        style={[
          typeStyle(marked ? 'recapLabelMarked' : 'recapLabel', tokens),
          { color: marked ? keyInk : colors.muted },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { alignSelf: 'stretch', gap: noticeCard.recap.gap },
  row: { flexDirection: 'row', gap: noticeCard.recap.gap },
  tile: { flex: 1 },
  number: {
    paddingVertical: noticeCard.recap.padding.vertical,
    paddingHorizontal: noticeCard.recap.padding.horizontal,
    gap: noticeCard.recap.lineGap,
  },
});
