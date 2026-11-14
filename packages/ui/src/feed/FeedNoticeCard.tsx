import {
  ENOUGH_FOR_TODAY_SEEN,
  sentences,
  type FeedNotice,
  type FirstWeekDay,
  type LevelMilestone,
} from '@slovo/core';
import type { MascotState } from '@slovo/contracts';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { noticeCard, typeStyle, wedges } from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { Button, type ButtonVariant } from '../primitives/Button';
import { Mascot } from '../primitives/Mascot';
import { usePageTurnActions, useTurnToNextPage } from '../primitives/VerticalPager';
import { Wedge } from '../primitives/Wedge';

/**
 * The ground of a Feed Notice's card: `surface` the card with a hairline,
 * `sunken` the darker card a Mascot sits on, `accent` the red card.
 */
export type NoticeTone = 'surface' | 'sunken' | 'accent';

/**
 * The frame of a Feed Notice's card, from the design: a rounded card in the
 * middle of the page, with the Mascot in a state at its top, if it has one,
 * then a title and a line of muted text, what the notice shows of its own
 * and a button, if it has them. The title is an eyebrow over what the notice
 * shows when it names the card rather than says something, and has the
 * notification mark before it on the notification ask. VoiceOver reads the
 * title and the text as one element, a sentence each, which turns the page
 * as a swipe would.
 */
export function FeedNoticeCard({
  notice,
  title,
  message,
  children,
  action,
  tone = 'surface',
  mascot,
  titleKind = 'title',
  gap = noticeCard.gap,
}: {
  notice: FeedNotice;
  title?: string | undefined;
  message?: string | undefined;
  /** What the notice shows under its text, such as a Word or a week's numbers. */
  children?: ReactNode;
  /** The button under the card, such as «Гортати далі», in the design's variant for it. */
  action?:
    | { readonly label: string; readonly onPress: () => void; readonly variant?: ButtonVariant }
    | undefined;
  tone?: NoticeTone;
  /** The Mascot's state at the top of the card, if the card has the Mascot. */
  mascot?: MascotState | undefined;
  /** `eyebrow` names the card over what it shows; `marked` puts the notification mark before it. */
  titleKind?: 'title' | 'eyebrow' | 'marked';
  /** The gap between the card's parts, when the notice's design gives another. */
  gap?: number;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyColors = useSchemeColors('light');
  const { voice } = useEdition();
  const turnActions = usePageTurnActions();
  const spoken = sentences([title, message]);
  const onAccent = tone === 'accent';
  const ink = onAccent ? keyColors.ink : colors.ink;
  const ground = {
    surface: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
    sunken: { backgroundColor: colors.surfaceSunken },
    accent: { backgroundColor: colors.accent },
  }[tone];
  const titleText = title !== undefined && (
    <Text
      style={[
        titleKind === 'eyebrow'
          ? [typeStyle('eyebrow', tokens), { color: colors.accentText }]
          : [typeStyle('noticeTitle', tokens), { color: ink }],
        titleKind === 'marked' && styles.markedTitle,
      ]}
    >
      {title}
    </Text>
  );
  return (
    <View testID={`feed-notice-${notice}`} style={[styles.card, ground, { gap }]}>
      {mascot !== undefined && (
        <View style={styles.mascot}>
          <Mascot state={mascot} />
        </View>
      )}
      {spoken !== '' && (
        <View
          accessible
          accessibilityLabel={spoken}
          {...voice}
          {...turnActions}
          style={styles.texts}
        >
          {titleKind === 'marked' ? (
            <View style={styles.markRow}>
              <NotificationMark />
              {titleText}
            </View>
          ) : (
            titleText
          )}
          {message !== undefined && (
            <Text
              style={
                title === undefined
                  ? [typeStyle('noticeTitle', tokens), { color: ink }]
                  : [
                      typeStyle('noticeText', tokens),
                      { color: onAccent ? keyColors.ink : colors.muted },
                    ]
              }
            >
              {message}
            </Text>
          )}
        </View>
      )}
      {children}
      {action !== undefined && (
        <Button
          variant={action.variant ?? 'neutral'}
          label={action.label}
          onPress={action.onPress}
          testID={`feed-notice-${notice}-action`}
        />
      )}
    </View>
  );
}

/** The red square with the ink wedge before the title of the notification ask. */
function NotificationMark() {
  const { colors } = useTokens();
  const keyColors = useSchemeColors('light');
  return (
    <View style={[styles.mark, { backgroundColor: colors.accent }]}>
      <Wedge
        points={wedges.logo}
        color={keyColors.ink}
        width={noticeCard.mark.wedge.width}
        height={noticeCard.mark.wedge.height}
      />
    </View>
  );
}

/**
 * «Може, на сьогодні досить?» after 50 distinct Seen Entries, its board text
 * under it with those 50 (ADR 0092), and «Гортати далі», which turns to the next card as a swipe would, and so closes the
 * card for the day; it never locks the Feed (ADR 0066).
 */
export function EnoughForTodayCard() {
  const { strings } = useEdition();
  const { message, body, keepGoing } = strings.feedNotices.enoughForToday;
  const turnToNext = useTurnToNextPage();
  return (
    <FeedNoticeCard
      notice="enoughForToday"
      tone="sunken"
      mascot="sleeps"
      title={message}
      message={fill(body, { n: String(ENOUGH_FOR_TODAY_SEEN) })}
      // Without the Feed's pager there is no next card to turn to, so no button.
      {...(turnToNext === undefined
        ? {}
        : {
            action: {
              label: keepGoing,
              onPress: () => {
                turnToNext();
              },
            },
          })}
    />
  );
}

/**
 * The notification explainer, or its one re-ask, with «Так», which asks the
 * device for permission to notify and turns to the next card; the iOS prompt
 * comes only after it (ADR 0067). A swipe past it is a refusal.
 */
export function NotificationAskCard({
  notice,
  onYes,
}: {
  notice: 'notificationExplainer' | 'notificationReask';
  onYes: () => void;
}) {
  const { strings } = useEdition();
  const { title, message, yes } = strings.feedNotices[notice];
  const turnToNext = useTurnToNextPage();
  return (
    <FeedNoticeCard
      notice={notice}
      titleKind="marked"
      title={title}
      message={message}
      action={{
        variant: 'primary',
        label: yes,
        onPress: () => {
          onYes();
          turnToNext?.();
        },
      }}
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
 * The offer to save progress to a reader with no Account (spec #1358 story
 * 70): its button opens the Account screen; a swipe closes it.
 */
export function SaveProgressCard({ onSave }: { onSave: () => void }) {
  const { strings } = useEdition();
  const { title, message, save } = strings.feedNotices.saveProgress;
  return (
    <FeedNoticeCard
      notice="saveProgress"
      tone="accent"
      title={title}
      message={message}
      action={{ variant: 'onAccent', label: save, onPress: onSave }}
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
      // The last day's «Тиждень із нами» has the happy Mascot on the darker card.
      tone={day === 7 ? 'sunken' : 'surface'}
      mascot={day === 7 ? 'happy' : undefined}
      title={title}
      message={text}
      action={{ variant: 'onAccent', label: close, onPress: () => turnToNext?.() }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: noticeCard.radius,
    padding: noticeCard.padding,
    gap: noticeCard.gap,
  },
  mascot: { alignSelf: 'flex-start' },
  texts: { gap: noticeCard.gap },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: noticeCard.gap },
  markedTitle: { flexShrink: 1 },
  mark: {
    width: noticeCard.mark.box,
    height: noticeCard.mark.box,
    borderRadius: noticeCard.mark.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
