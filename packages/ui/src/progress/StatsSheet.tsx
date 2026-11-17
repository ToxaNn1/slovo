import type { EntryKind } from '@slovo/contracts';
import { GAME_ROUNDS, type ProgressState } from '@slovo/core';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { knownLine } from './known-line';
import { moodLine, type MoodDays } from './mood-line';
import { fill, useEdition } from '../providers/EditionProvider';
import { fontScaleCap, space, STACK_AT_FONT_SCALE, statsSheetLayout, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

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
      style={[
        styles.count,
        stacked && styles.countStacked,
        { backgroundColor: colors.surfaceSunken },
      ]}
    >
      <Text
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[typeStyle('statsCount', tokens), { color: colors.ink }]}
      >
        {value}
      </Text>
      <Text style={[typeStyle('statsCountLabel', tokens), { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * The stats sheet the Stats pill opens, in the cards of XSaved's Streak
 * screens (`statsSheetLayout`): the big Streak with its Best Streak on an ink
 * card, then, each on its own card, the Entries Seen
 * today, the Favorites count, the Entries in Collections and the best Game
 * result once a Game has finished, each in the Edition's plural form, and
 * under them the Known count of each kind of Entry shown, and the Entries
 * due for Review today, unless the knowledge rows are hidden, then the days
 * by Mood once a Mood was chosen: the Known counts two by two under «ЗНАЮ»
 * on a card of their own, the due and Mood lines on the next; the Active Days
 * calendar lives on the profile alone (owner, 17.11). No scroll bar shows. It
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
  moodDays = [],
  onClose,
}: {
  visible: boolean;
  stats: ProgressState;
  hideStreak?: boolean;
  /** The knowledge rows, with the kinds of Entry whose Known count shows, in order, or none. */
  knowledge?: readonly EntryKind[] | 'none';
  /** The days each Mood was chosen on, in display order; without a chosen day the row is left out. */
  moodDays?: readonly MoodDays[];
  onClose: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count, form } = useEdition();
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  const words = strings.stats;
  const streak = count(words.streak, stats.streak);
  const bestStreak = fill(words.bestStreak, { count: String(stats.bestStreak) });
  const { bestResult } = stats;
  const moods = moodLine(words, moodDays, count);
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="stats-sheet">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* VoiceOver reads the sheet's name first, then the texts in the order they show, as it reads a group. */}
        {!hideStreak && (
          <View
            testID="stats-streak"
            accessible
            accessibilityRole="header"
            accessibilityLabel={[words.title, String(stats.streak), streak, bestStreak].join(', ')}
            {...voice}
            style={[
              styles.streakRow,
              stacked && styles.streakStacked,
              { backgroundColor: colors.ink },
            ]}
          >
            <Text
              maxFontSizeMultiplier={fontScaleCap.text}
              style={[typeStyle('statsStreak', tokens), { color: colors.accent }]}
            >
              {stats.streak}
            </Text>
            <View style={stacked ? styles.streakWordsStacked : styles.streakWords}>
              <Text style={[typeStyle('statsStreakLabel', tokens), { color: colors.background }]}>
                {streak}
              </Text>
              <Text
                style={[
                  typeStyle('statsNote', tokens),
                  styles.bestStreak,
                  { color: colors.background },
                ]}
              >
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
          <View
            testID="stats-known"
            accessible
            accessibilityLabel={knownLine(words, stats.known, knowledge, count)}
            {...voice}
            style={[styles.lines, { backgroundColor: colors.surfaceSunken }]}
          >
            <Text
              style={[typeStyle('statsKicker', tokens), styles.kicker, { color: colors.muted }]}
            >
              {fill(words.known, { counts: '' }).trim()}
            </Text>
            <View style={styles.kinds}>
              {knowledge.map((kind) => (
                <View key={kind} style={[styles.kind, stacked && styles.countStacked]}>
                  <Text
                    maxFontSizeMultiplier={fontScaleCap.text}
                    style={[typeStyle('statsKnownCount', tokens), { color: colors.ink }]}
                  >
                    {stats.known[kind]}
                  </Text>
                  <Text style={[typeStyle('statsCountLabel', tokens), { color: colors.muted }]}>
                    {fill(form(words.knownByKind[kind], stats.known[kind]), { count: '' }).trim()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {(knowledge !== 'none' || moods !== undefined) && (
          <View style={[styles.lines, { backgroundColor: colors.surfaceSunken }]}>
            {knowledge !== 'none' && (
              <Text
                testID="stats-due-today"
                {...voice}
                style={[typeStyle('statsLine', tokens), { color: colors.ink }]}
              >
                {fill(words.dueToday, { count: String(stats.dueToday) })}
              </Text>
            )}
            {moods !== undefined && (
              <Text
                testID="stats-moods"
                {...voice}
                style={[typeStyle('statsLine', tokens), { color: colors.ink }]}
              >
                {moods}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const card = statsSheetLayout;

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: {
    paddingHorizontal: space[1],
    paddingTop: space[4],
    paddingBottom: space[4],
    gap: card.gap,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: card.streakCard.gap,
    padding: card.streakCard.padding,
    borderRadius: card.streakCard.radius,
  },
  streakStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: space[2] },
  streakWords: { flex: 1, gap: space[1] },
  streakWordsStacked: { gap: space[1] },
  bestStreak: { opacity: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: card.gap },
  // Two cards a row; a card left alone on its row takes the whole row.
  count: {
    flexGrow: 1,
    flexBasis: '40%',
    padding: card.countCard.padding,
    gap: card.countCard.gap,
    borderRadius: card.countCard.radius,
  },
  countStacked: { flexBasis: '100%' },
  kicker: { textTransform: 'uppercase' },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[4] },
  // Two kinds a row, each its number over its name.
  kind: { flexBasis: '50%', gap: space[1], paddingRight: space[3] },
  lines: {
    padding: card.linesCard.padding,
    gap: card.linesCard.gap,
    borderRadius: card.linesCard.radius,
  },
});
