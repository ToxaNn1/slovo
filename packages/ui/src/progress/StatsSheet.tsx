import type { EntryKind } from '@slovo/contracts';
import { GAME_ROUNDS, type ProgressState } from '@slovo/core';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { knownLine } from './known-line';
import { OrnamentBand } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { space, STACK_AT_FONT_SCALE, typeSize } from '../tokens';
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
  const { colors, fontFamilies } = useTokens();
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
        style={[styles.countValue, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {value}
      </Text>
      <Text style={[styles.countLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The stats sheet the Stats pill opens (design `stats-sheet-dark`): the big
 * Streak with its Best Streak, Decor slot 2's band, then the Entries Seen
 * today, the Favorites count, the Entries in Collections and the best Game
 * result once a Game has finished, each in the Edition's plural form, and
 * under them the Known count of each kind of Entry shown, and the Entries
 * due for Review today, unless the knowledge rows are hidden. It
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
  onClose,
}: {
  visible: boolean;
  stats: ProgressState;
  hideStreak?: boolean;
  /** The knowledge rows, with the kinds of Entry whose Known count shows, in order, or none. */
  knowledge?: readonly EntryKind[] | 'none';
  onClose: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  const words = strings.stats;
  const streak = count(words.streak, stats.streak);
  const bestStreak = fill(words.bestStreak, { count: String(stats.bestStreak) });
  const { bestResult } = stats;
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
              style={[styles.streakValue, { color: colors.ink, fontFamily: fontFamilies.word }]}
            >
              {stats.streak}
            </Text>
            <View style={stacked ? styles.streakWordsStacked : styles.streakWords}>
              <Text
                style={[styles.streakLabel, { color: colors.ink, fontFamily: fontFamilies.ui }]}
              >
                {streak}
              </Text>
              <Text
                style={[styles.bestStreak, { color: colors.muted, fontFamily: fontFamilies.ui }]}
              >
                {bestStreak}
              </Text>
            </View>
          </View>
        )}
        <OrnamentBand />
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
              style={[styles.knowledgeRow, { color: colors.ink, fontFamily: fontFamilies.ui }]}
            >
              {knownLine(words, stats.known, knowledge, count)}
            </Text>
            <Text
              testID="stats-due-today"
              {...voice}
              style={[styles.knowledgeRow, { color: colors.ink, fontFamily: fontFamilies.ui }]}
            >
              {fill(words.dueToday, { count: String(stats.dueToday) })}
            </Text>
          </View>
        )}
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
  streakValue: { fontSize: typeSize.streak, fontWeight: '500', lineHeight: typeSize.streak * 1.1 },
  streakStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: space[2] },
  streakWords: { flex: 1, gap: space[1] },
  streakWordsStacked: { gap: space[1] },
  streakLabel: { fontSize: typeSize.explanation, fontWeight: '600' },
  bestStreak: { fontSize: typeSize.caption },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space[6],
    marginTop: space[6],
  },
  knowledge: { marginTop: space[6], gap: space[2] },
  knowledgeRow: { fontSize: typeSize.explanation },
  count: { paddingRight: space[3], gap: space[1] },
  countValue: { fontSize: typeSize.count, fontWeight: '500' },
  countLabel: { fontSize: typeSize.caption },
});
