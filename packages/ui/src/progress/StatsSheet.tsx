import type { EntryKind } from '@slovo/contracts';
import { GAME_ROUNDS, type CalendarWeek, type ProgressState } from '@slovo/core';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { ActiveDaysCalendar } from './ActiveDaysCalendar';
import { knownLine } from './known-line';
import { moodLine, type MoodDays } from './mood-line';
import { fill, useEdition } from '../providers/EditionProvider';
import { space, STACK_AT_FONT_SCALE, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the numbers, so the big Streak fits beside its words. */
const NUMBER_MAX_FONT_SCALE = 1.5;

/** One count of the sheet's grid: the number over the words that name it. */
function Count({
  value,
  label,
  stacked,
  testID,
  spoken,
}: {
  value: number | string;
  label: string;
  stacked: boolean;
  testID: string;
  /** What VoiceOver reads for it, when the number and its words don't say it well. */
  spoken?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    // VoiceOver reads the number and its words as one element, in the order they show.
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken}
      {...voice}
      style={[styles.count, { width: stacked ? '100%' : '50%' }]}
    >
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[typeStyle('statsCount', tokens), { color: colors.ink }]}
      >
        {value}
      </Text>
      <Text style={[typeStyle('statsNote', tokens), { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * The stats sheet the Stats pill opens (design `stats-sheet-dark`): the big
 * Streak with its Best Streak, then the Entries Seen
 * today, the Favorites count, the Entries in Collections and the best Game
 * result once a Game has finished, each in the Edition's plural form, and
 * under them the Known count of each kind of Entry shown, and the Entries
 * due for Review today, unless the knowledge rows are hidden, then the days
 * by Mood once a Mood was chosen, and last the
 * Active Days calendar, with its weeks, unless it has none. It
 * closes with a swipe down, a tap outside or VoiceOver's escape gesture, and
 * with Reduce Motion it appears without sliding. While the reader hides the
 * Streak, the Streak with its Best Streak is left out. Needs a
 * `SafeAreaProvider` above it.
 */
export function StatsSheet({
  visible,
  stats,
  hideStreak = false,
  knowledge = ['word', 'correction', 'idiom'],
  calendar = [],
  moodDays = [],
  onClose,
}: {
  visible: boolean;
  stats: ProgressState;
  hideStreak?: boolean;
  /** The knowledge rows, with the kinds of Entry whose Known count shows, in order, or none. */
  knowledge?: readonly EntryKind[] | 'none';
  /** The weeks of the Active Days calendar; none leaves it out. */
  calendar?: readonly CalendarWeek[];
  /** The days each Mood was chosen on, in display order; without a chosen day the row is left out. */
  moodDays?: readonly MoodDays[];
  onClose: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count } = useEdition();
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  const words = strings.stats;
  const streak = count(words.streak, stats.streak);
  const bestStreak = fill(words.bestStreak, { count: String(stats.bestStreak) });
  const { bestResult } = stats;
  const moods = moodLine(words, moodDays, count);
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="stats-sheet">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* VoiceOver reads the sheet's name first, then the texts in the order they show, as it reads a group. */}
        {!hideStreak && (
          <View
            testID="stats-streak"
            accessible
            accessibilityRole="header"
            accessibilityLabel={[words.title, String(stats.streak), streak, bestStreak].join(', ')}
            {...voice}
            style={[styles.streakRow, stacked && styles.streakStacked]}
          >
            <Text
              maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
              style={[typeStyle('statsStreak', tokens), { color: colors.ink }]}
            >
              {stats.streak}
            </Text>
            <View style={stacked ? styles.streakWordsStacked : styles.streakWords}>
              <Text style={[typeStyle('statsStreakLabel', tokens), { color: colors.ink }]}>
                {streak}
              </Text>
              <Text style={[typeStyle('statsNote', tokens), { color: colors.muted }]}>
                {bestStreak}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.grid}>
          <Count
            testID="stats-seen-today"
            stacked={stacked}
            value={stats.seenToday}
            label={count(words.seenToday, stats.seenToday)}
          />
          <Count
            testID="stats-favorites"
            stacked={stacked}
            value={stats.favorites}
            label={words.favorites}
          />
          <Count
            testID="stats-in-collections"
            stacked={stacked}
            value={stats.inCollections}
            label={count(words.inCollections, stats.inCollections)}
          />
          {bestResult === undefined ? null : (
            <Count
              testID="stats-game-best"
              stacked={stacked}
              value={fill(strings.game.round.progress, {
                passed: String(bestResult),
                total: String(GAME_ROUNDS),
              })}
              label={count(words.gameBest, bestResult)}
              spoken={fill(count(words.gameBestLabel, bestResult), {
                total: String(GAME_ROUNDS),
              })}
            />
          )}
        </View>
        {knowledge !== 'none' && (
          <View style={styles.knowledge}>
            <Text
              testID="stats-known"
              {...voice}
              style={[typeStyle('statsLine', tokens), { color: colors.ink }]}
            >
              {knownLine(words, stats.known, knowledge, count)}
            </Text>
            <Text
              testID="stats-due-today"
              {...voice}
              style={[typeStyle('statsLine', tokens), { color: colors.ink }]}
            >
              {fill(words.dueToday, { count: String(stats.dueToday) })}
            </Text>
          </View>
        )}
        {moods !== undefined && (
          <Text
            testID="stats-moods"
            {...voice}
            style={[styles.moods, typeStyle('statsLine', tokens), { color: colors.ink }]}
          >
            {moods}
          </Text>
        )}
        <ActiveDaysCalendar weeks={calendar} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: space[1], paddingTop: space[4], paddingBottom: space[4] },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    marginBottom: space[6],
  },
  streakStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: space[2] },
  streakWords: { flex: 1, gap: space[1] },
  streakWordsStacked: { gap: space[1] },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[6],
    marginTop: space[6],
  },
  knowledge: { marginTop: space[6], gap: space[2] },
  moods: { marginTop: space[2] },
  count: { paddingRight: space[3], gap: space[1] },
});
