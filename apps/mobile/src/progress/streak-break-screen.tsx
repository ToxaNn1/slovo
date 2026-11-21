import { pluralCount } from '@slovo/contracts';
import { BREAK_DAYS_AT_MOST } from '@slovo/core';
import {
  BackHeader,
  BreakCard,
  fill,
  Button,
  SectionLabel,
  space,
  Stepper,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { edition, editionStrings } from '../edition/edition';
import { useSubscribed } from '../opening';
import { dayText } from './day-text';

const strings = editionStrings.settings.streakBreak;
const card = editionStrings.settings.profile.breakCard;
const plural = pluralCount(edition.locale);

/**
 * Settings › Перерва (ADR 0066, board 11, 90): what a Break does, and
 * either its length on a − N + stepper from 1 to the Break days left, with a
 * line saying so at its top, and the button that starts it; or, while one
 * runs, the Break card of board 10 p1 (the paused Streak, its last day, its
 * strip, the next start), its days left and «Завершити перерву», which ends it
 * today; or, once the 7 days are spent, the day the next Break can start.
 */
export function StreakBreakScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();
  const streakBreak = useComposition().streakBreak;
  const state = useSubscribed(streakBreak, ({ state }) => state);
  const progress = useComposition().progress;
  const streak = useSubscribed(progress, ({ state }) => state.streak);
  const [days, setDays] = useState(7);
  const longest = state.kind === 'available' ? state.longest : 0;
  const chosen = Math.min(days, longest);
  const textStyle = [typeStyle('noticeText', tokens), { color: colors.muted }];

  return (
    <SafeAreaView
      testID="streak-break"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={strings.title}
          back={{
            label: editionStrings.settings.title,
            testID: 'streak-break-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        testID="streak-break-scroll"
        contentContainerStyle={styles.content}
      >
        {state.kind !== 'running' && (
          <View style={styles.section}>
            <Text {...voice} style={textStyle}>
              {strings.explanation}
            </Text>
          </View>
        )}
        {state.kind === 'available' && (
          <View style={styles.section}>
            <SectionLabel>{strings.length}</SectionLabel>
            <Stepper
              testID="streak-break-days"
              accessibilityLabel={strings.length}
              fewerLabel={strings.fewerDays}
              moreLabel={strings.moreDays}
              value={chosen}
              min={1}
              max={longest}
              onChange={setDays}
            />
            {chosen === longest && (
              <Text {...voice} testID="streak-break-most" style={textStyle}>
                {longest >= BREAK_DAYS_AT_MOST ? strings.most : plural(strings.mostLeft, longest)}
              </Text>
            )}
            <Button
              testID="streak-break-start"
              label={strings.start}
              onPress={() => {
                void keep('the Break', streakBreak.start(chosen));
              }}
            />
          </View>
        )}
        {state.kind === 'running' && (
          <View style={styles.section}>
            <BreakCard
              testID="streak-break-running"
              streak={streak}
              kicker={card.kicker}
              paused={fill(card.paused, { count: String(streak) })}
              until={fill(strings.running, { date: dayText(state.lastDay) })}
              strip={state.strip}
              next={fill(card.next, { date: dayText(state.nextStart) })}
            />
            <Text {...voice} testID="streak-break-days-left" style={textStyle}>
              {plural(strings.daysLeft, state.daysLeft)}
            </Text>
            <Button
              testID="streak-break-end"
              label={strings.end}
              onPress={() => {
                void keep('the Break end', streakBreak.end());
              }}
            />
          </View>
        )}
        {state.kind === 'waiting' && (
          <Text {...voice} testID="streak-break-waiting" style={textStyle}>
            {fill(strings.waiting, { date: dayText(state.nextStart) })}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  section: { gap: space[3], paddingTop: space[2], paddingBottom: space[5] },
});
