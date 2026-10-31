import { sentences, type FeedNotice, type FirstWeekDay, type LevelMilestone } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { usePageTurnActions, useTurnToNextPage } from '../primitives/VerticalPager';

/**
 * The frame of a Feed Notice's card: a title and a line of muted text,
 * centred on the Feed's background like the end-of-Cycle card, then what
 * the notice shows of its own and a button, if it has them. VoiceOver reads
 * the title and the text as one element, a sentence each, which turns the
 * page as a swipe would.
 */
export function FeedNoticeCard({
  notice,
  title,
  message,
  children,
  action,
}: {
  notice: FeedNotice;
  title?: string | undefined;
  message?: string | undefined;
  /** What the notice shows under its text, such as a Word or a week's numbers. */
  children?: ReactNode;
  /** The button under the card, such as «Гортати далі». */
  action?: { readonly label: string; readonly onPress: () => void } | undefined;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const turnActions = usePageTurnActions();
  const spoken = sentences([title, message]);
  return (
    <View testID={`feed-notice-${notice}`} style={styles.card}>
      {spoken !== '' && (
        <View accessible accessibilityLabel={spoken} {...voice} {...turnActions}>
          {title !== undefined && (
            <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}>
              {title}
            </Text>
          )}
          {message !== undefined && (
            <Text
              style={[
                title === undefined ? styles.title : styles.message,
                title === undefined
                  ? { color: colors.ink, fontFamily: fontFamilies.word }
                  : { color: colors.muted, fontFamily: fontFamilies.ui },
              ]}
            >
              {message}
            </Text>
          )}
        </View>
      )}
      {children}
      {action !== undefined && (
        <View style={styles.action}>
          <SecondaryButton
            label={action.label}
            onPress={action.onPress}
            testID={`feed-notice-${notice}-action`}
          />
        </View>
      )}
    </View>
  );
}

/**
 * The Daily Limit card: «На сьогодні досить. Повертайтеся завтра» with
 * «Гортати далі», which turns to the next card as a swipe would, and so
 * closes the card for the day (ADR 0054).
 */
export function DailyLimitCard() {
  const { strings } = useEdition();
  const { message, keepGoing } = strings.feedNotices.dailyLimit;
  const turnToNext = useTurnToNextPage();
  return (
    <FeedNoticeCard
      notice="dailyLimit"
      message={message}
      action={{ label: keepGoing, onPress: () => turnToNext?.() }}
    />
  );
}

/**
 * The level-milestone card at Levels 5, 10 and 20: the Level with the
 * Edition's name for it, and a suggestion of a wider rarity or a new
 * Category that forces nothing, so it has no button; a swipe closes it
 * (ADR 0066).
 */
export function LevelMilestoneCard({ level, name }: { level: LevelMilestone; name: string }) {
  const { strings } = useEdition();
  const { title, message } = strings.feedNotices.levelMilestone;
  return (
    <FeedNoticeCard
      notice="levelMilestone"
      title={fill(title, { level: String(level), name })}
      message={message}
    />
  );
}

/**
 * The first-week card of its day: what the app offers that day, and on day 7
 * «Тиждень із нами» with the Streak, or with no Streak named while the reader
 * doesn't see it. «Зрозуміло» turns to the next card as a swipe would, and so
 * closes the card; no later day brings it back (ADR 0054).
 */
export function FirstWeekCard({
  day,
  streak,
}: {
  day: FirstWeekDay;
  /** The Streak, or undefined while the reader doesn't see it. */
  streak: number | undefined;
}) {
  const { strings, count } = useEdition();
  const { close, days, lastDayTitle, lastDayText, lastDayTextNoStreak } =
    strings.feedNotices.firstWeek;
  const turnToNext = useTurnToNextPage();
  const [day1, day2, day3, day4, day5, day6] = days;
  const cards: Record<FirstWeekDay, { readonly title: string; readonly text: string }> = {
    1: day1,
    2: day2,
    3: day3,
    4: day4,
    5: day5,
    6: day6,
    7: {
      title: lastDayTitle,
      text: streak === undefined ? lastDayTextNoStreak : count(lastDayText, streak),
    },
  };
  const { title, text } = cards[day];
  return (
    <FeedNoticeCard
      notice="firstWeek"
      title={title}
      message={text}
      action={{ label: close, onPress: () => turnToNext?.() }}
    />
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Narrow enough that a title breaks into two balanced lines, as on the end-of-Cycle card.
  title: {
    maxWidth: 260,
    fontSize: typeSize.emptyStateTitle,
    lineHeight: typeSize.emptyStateTitle * 1.2,
    fontWeight: '500',
    textAlign: 'center',
  },
  message: {
    maxWidth: 300,
    marginTop: space[4],
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.6,
    textAlign: 'center',
  },
  action: { alignSelf: 'stretch', marginTop: space[8] },
});
