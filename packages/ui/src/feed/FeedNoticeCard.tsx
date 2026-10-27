import type { FeedNotice } from '@slovo/core';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { usePageTurnActions, useTurnToNextPage } from '../primitives/VerticalPager';

/**
 * The frame of a Feed Notice's card: a title and a line of muted text,
 * centred on the Feed's background like the end-of-Cycle card, then what
 * the notice shows of its own and a button, if it has them. VoiceOver reads
 * the title and the text as one element, which turns the page as a swipe
 * would.
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
  const text = [title, message].filter((each) => each !== undefined);
  return (
    <View testID={`feed-notice-${notice}`} style={styles.card}>
      {text.length > 0 && (
        <View accessible accessibilityLabel={text.join('. ')} {...voice} {...turnActions}>
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
