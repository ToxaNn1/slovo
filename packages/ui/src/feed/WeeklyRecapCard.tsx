'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { Plural } from '@slovo/contracts';
import { sentences, type LocalDate, type WeeklyRecapModel } from '@slovo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { IconButton } from '../primitives/IconButton';
import { PressedTile } from '../primitives/PressedTile';
import { bezier } from '../primitives/timing';
import { useCascade } from '../primitives/useCascade';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { fontScaleCap, motion, noticeCard, typeStyle, weeklyRecapPage } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

const { enter, pop, fold, below } = weeklyRecapPage;
const popEasing = bezier(motion.pop.easing);
const foldEasing = bezier(fold.easing);
const belowEasing = bezier(below.easing);

/**
 * The Weekly Recap card «Твій тиждень» (board f5): its title with the week's
 * dates and, when sharing is there, the Share icon in the top-right corner;
 * the past week's Entries Seen, Favorites added and Known marks, and the
 * current Streak, then the week's XP and goal days out of 7, each on a tile
 * three to a row, the Streak's tile red (ADR 0054); and «Готово», which
 * folds the card away (ADR 0130).
 * The Known number, the XP and the goal days are left out when the recap has
 * none, and the Streak while the reader hides it. Until its numbers are read
 * the card shows its title alone.
 * It rises in, its tiles popping in one after another; «Готово» plays the
 * fold, then tells `onDone`. Under Reduce Motion it only fades in, and
 * «Готово» tells `onDone` at once.
 */
export function WeeklyRecapCard({
  recap,
  hideStreak = false,
  onShare,
  onDone,
}: {
  recap: WeeklyRecapModel | undefined;
  hideStreak?: boolean;
  /** Opens the share sheet with the recap's Share Card; without it, no Share. */
  onShare?: (() => void) | undefined;
  /** Folds the card away once its fold has played; without it, no «Готово». */
  onDone?: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { strings, voice } = useEdition();
  const turnActions = usePageTurnActions();
  const words = strings.feedNotices.weeklyRecap;
  const entered = useCascade(0, {
    variant: 'rise',
    stagger: 0,
    duration: enter.duration,
    delay: enter.delay,
  });
  const folding = useFold(onDone);
  const dates = recap === undefined ? undefined : datesOf(words.dates, recap);
  const numbers =
    recap === undefined
      ? []
      : (
          [
            { key: 'seen', value: recap.seen, shows: String(recap.seen) },
            { key: 'saved', value: recap.saved, shows: String(recap.saved) },
            { key: 'known', value: recap.known, shows: String(recap.known) },
            {
              key: 'streak',
              value: hideStreak ? undefined : recap.streak,
              shows: String(recap.streak),
            },
            { key: 'xp', value: recap.xp, shows: String(recap.xp) },
            {
              key: 'goalDays',
              value: recap.goalDays,
              shows: fill(words.goalDaysOfWeek, { count: String(recap.goalDays) }),
            },
          ] as const
        ).flatMap(({ key, value, shows }) =>
          value === undefined
            ? []
            : [{ key, value, shows, label: words[key], spoken: words.spoken[key] }],
        );
  return (
    <Animated.View
      testID="weekly-recap"
      onLayout={folding.measure}
      style={[styles.folding, folding.style]}
    >
      <Animated.View style={entered}>
        <FeedNoticeCard notice="weeklyRecap" gap={weeklyRecapPage.gap}>
          <View style={styles.titleRow}>
            <View
              accessible
              accessibilityLabel={sentences([words.title, dates])}
              {...voice}
              {...turnActions}
              style={styles.titleTexts}
            >
              <Text style={[typeStyle('noticeTitle', tokens), styles.title, { color: colors.ink }]}>
                {words.title}
              </Text>
              {dates !== undefined && (
                <Text style={[typeStyle('recapDates', tokens), { color: colors.muted }]}>
                  {dates}
                </Text>
              )}
            </View>
            {recap !== undefined && onShare !== undefined && (
              <IconButton
                icon="share"
                accessibilityLabel={strings.share.share}
                onPress={onShare}
                testID="feed-notice-weeklyRecap-share"
              />
            )}
          </View>
          {numbers.length > 0 && (
            <View style={styles.grid}>
              {rowsOf(numbers, noticeCard.recap.columns).map((row, rowIndex) => (
                <View key={row.map(({ key }) => key).join()} style={styles.row}>
                  {row.map(({ key, value, shows, label, spoken }, column) => (
                    <RecapNumber
                      key={key}
                      testID={`weekly-recap-${key}`}
                      index={rowIndex * noticeCard.recap.columns + column}
                      value={value}
                      shows={shows}
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
          {recap !== undefined && onDone !== undefined && (
            <PressedTile
              tone="inverse"
              depth="action"
              radius={radii.button}
              onPress={folding.start}
              accessibilityLabel={words.done}
              faceStyle={styles.done}
              testID="feed-notice-weeklyRecap-done"
            >
              <Text
                {...voice}
                maxFontSizeMultiplier={fontScaleCap.number}
                style={[typeStyle('recapDone', tokens), { color: colors.background }]}
              >
                {words.done}
              </Text>
            </PressedTile>
          )}
        </FeedNoticeCard>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * What sits under «Твій тиждень» on its page, Yesterday, which enters on its
 * own: once the card is `folded` away it slides up into its place (the
 * board's `ywUp`). Under Reduce Motion it stays.
 */
export function UnderWeeklyRecap({ folded, children }: { folded: boolean; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (!folded || reduceMotion) return;
    lift.value = withSequence(
      withTiming(below.rise, { duration: 0, reduceMotion: ReduceMotion.Never }),
      withTiming(0, {
        duration: below.riseDuration,
        easing: belowEasing,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [folded, reduceMotion, lift]);
  const lifted = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return <Animated.View style={lifted}>{children}</Animated.View>;
}

/** The week's dates, «26.10–1.11»: each day and its month as numbers, the month in two digits. */
function datesOf(template: string, { firstDay, lastDay }: WeeklyRecapModel): string {
  const month = ({ month: number }: LocalDate) => String(number).padStart(2, '0');
  return fill(template, {
    fromDay: String(firstDay.day),
    fromMonth: month(firstDay),
    toDay: String(lastDay.day),
    toMonth: month(lastDay),
  });
}

/**
 * The card's fold (the board's `wkOut`): it fades, rises, turns and shrinks,
 * then its room closes, and `onDone` is told; under Reduce Motion `onDone`
 * is told at once. The room closes only once the card's height is measured.
 */
function useFold(onDone: (() => void) | undefined) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const height = useSharedValue(0);
  const [started, setStarted] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => done.current?.(), fold.duration);
    return () => {
      clearTimeout(timer);
    };
  }, [started]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    if (p === 0) return {};
    const out = Math.min(p / fold.share, 1);
    const closing = Math.max((p - fold.share) / (1 - fold.share), 0);
    return {
      opacity: 1 - out,
      transform: [
        { translateY: fold.rise * out },
        { rotate: `${String(fold.turn * out)}deg` },
        { scale: 1 - (1 - fold.scale) * out },
      ],
      ...(height.value > 0
        ? {
            height: height.value * (1 - closing),
            marginBottom: -weeklyRecapPage.pageGap * closing,
          }
        : {}),
    };
  });
  return {
    style,
    measure: ({ nativeEvent }: { nativeEvent: { layout: { height: number } } }) => {
      if (progress.value === 0) height.value = nativeEvent.layout.height;
    },
    start: () => {
      if (started) return;
      if (reduceMotion) {
        onDone?.();
        return;
      }
      setStarted(true);
      progress.value = withTiming(1, {
        duration: fold.duration,
        easing: foldEasing,
        reduceMotion: ReduceMotion.Never,
      });
    },
  };
}

/** The items in rows of `columns`, the last row possibly shorter. */
function rowsOf<Item>(items: readonly Item[], columns: number): Item[][] {
  return Array.from({ length: Math.ceil(items.length / columns) }, (_, row) =>
    items.slice(row * columns, (row + 1) * columns),
  );
}

function RecapNumber({
  value,
  shows,
  label,
  spoken,
  testID,
  index,
  marked,
}: {
  value: number;
  /** The number as the tile shows it, the goal days out of 7. */
  shows: string;
  label: string;
  /** What VoiceOver reads for the number, in the Edition's plural forms. */
  spoken: Plural;
  testID: string;
  /** The tile's place on the card, which it pops in after (the board's `slPop`). */
  index: number;
  /** The Streak's tile: red, with the key ink. */
  marked: boolean;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice, count } = useEdition();
  const popped = usePop(index);
  const ink = marked ? keyInk : colors.ink;
  return (
    // VoiceOver reads the number and its label as one element, in the Edition's words.
    <Animated.View
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
        popped,
      ]}
    >
      <Text
        maxFontSizeMultiplier={fontScaleCap.text}
        style={[typeStyle('recapNumber', tokens), { color: ink }]}
      >
        {shows}
      </Text>
      <Text
        style={[
          typeStyle(marked ? 'recapLabelMarked' : 'recapLabel', tokens),
          { color: marked ? keyInk : colors.muted },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

/** A tile's pop (the board's `slPop`), after the tiles before it; none under Reduce Motion. */
function usePop(index: number) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(reduceMotion ? 1 : pop.from);
  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    const leg = (to: number, duration: number) =>
      withTiming(to, { duration, easing: popEasing, reduceMotion: ReduceMotion.Never });
    scale.value = withDelay(
      pop.delay + index * pop.stagger,
      withSequence(
        leg(pop.peak, pop.duration * pop.peakAt),
        leg(1, pop.duration * (1 - pop.peakAt)),
      ),
      ReduceMotion.Never,
    );
  }, [scale, index, reduceMotion]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

const styles = StyleSheet.create({
  folding: { transformOrigin: 'top' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: weeklyRecapPage.titleGap },
  titleTexts: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: weeklyRecapPage.titleGap,
  },
  title: { flexShrink: 1 },
  grid: { alignSelf: 'stretch', gap: noticeCard.recap.gap },
  row: { flexDirection: 'row', gap: noticeCard.recap.gap },
  tile: { flex: 1 },
  number: {
    paddingVertical: noticeCard.recap.padding.vertical,
    paddingHorizontal: noticeCard.recap.padding.horizontal,
    gap: noticeCard.recap.lineGap,
  },
  done: {
    minHeight: weeklyRecapPage.doneHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
