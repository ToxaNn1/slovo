import type { WeeklyRecapModel } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeSize } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/** How far a number grows with the text size, so four of them still fit the card. */
const NUMBER_MAX_FONT_SCALE = 1.5;

/**
 * The Weekly Recap card «Ваш тиждень» in the Feed Notice frame: the past
 * week's Entries Seen, Favorites added and Known marks, and the current
 * Streak, two numbers to a row (ADR 0054). The Known number is left out when
 * the recap has none, and the Streak while the reader hides it. «Поділитися»
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
      : [
          { key: 'seen', value: recap.seen, label: words.seen },
          { key: 'saved', value: recap.saved, label: words.saved },
          ...(recap.known === undefined
            ? []
            : [{ key: 'known', value: recap.known, label: words.known }]),
          ...(hideStreak ? [] : [{ key: 'streak', value: recap.streak, label: words.streak }]),
        ];
  return (
    <FeedNoticeCard
      notice="weeklyRecap"
      title={words.title}
      action={
        recap === undefined || onShare === undefined
          ? undefined
          : { label: strings.share.share, onPress: onShare }
      }
    >
      {numbers.length > 0 && (
        <View style={styles.grid}>
          {numbers.map(({ key, value, label }) => (
            <RecapNumber key={key} testID={`weekly-recap-${key}`} value={value} label={label} />
          ))}
        </View>
      )}
    </FeedNoticeCard>
  );
}

function RecapNumber({ value, label, testID }: { value: number; label: string; testID: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    // VoiceOver reads the number and its label as one element.
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${String(value)} ${label}`}
      {...voice}
      style={styles.number}
    >
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[styles.value, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    rowGap: space[6],
    marginTop: space[8],
  },
  number: { width: '50%', alignItems: 'center', gap: space[1] },
  value: { fontSize: typeSize.count, fontWeight: '500' },
  label: { fontSize: typeSize.caption, textAlign: 'center' },
});
