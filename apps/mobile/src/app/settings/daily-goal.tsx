import { pluralCount, type DailyGoal } from '@slovo/contracts';
import { OptionSampleNumber, OptionScreen, useTokens } from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';
import { useSetDailyGoal, useXpLogState } from '@/progress/xp-log';
import { useShown } from '@/shown-in-effect';

const strings = editionStrings.settings.dailyGoal;

/** The option of «Без цілі», which turns the Daily Goal off from today (ADR 0074). */
const NO_DAILY_GOAL = 'none';

/** What the big number shows under «Без цілі», which has no number. */
const NO_GOAL_SAMPLE = '—';

/**
 * Settings › «Ціль дня», screen 85 of board 11: today's Daily Goal as a big
 * number over the line that explains it, then the Edition's goals and
 * «Без цілі». A tap writes the goal into the XP log, as the onboarding does.
 * With the `dailyGoal` Feature Switch off in effect it leads back to Settings.
 */
export default function DailyGoalScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  const edition = useEditionInEffect();
  const shown = useShown();
  const { dailyGoal } = useXpLogState();
  const setDailyGoal = useSetDailyGoal();
  if (!shown.dailyGoal || !edition.isFeatureEnabled('xpLog')) return <Redirect href="/settings" />;
  const goals = edition.dailyGoals.options;
  const goalLabel = pluralCount(edition.locale);
  const selected = dailyGoal === null ? NO_DAILY_GOAL : String(dailyGoal.goal);
  return (
    <SafeAreaView
      testID="daily-goal-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <OptionScreen
        testID="daily-goal"
        title={strings.title}
        subtitle={strings.subtitle}
        back={{
          label: editionStrings.settings.title,
          testID: 'daily-goal-back',
          onPress: () => {
            router.back();
          },
        }}
        sample={<OptionSampleNumber value={dailyGoal === null ? NO_GOAL_SAMPLE : selected} />}
        explanation={explanationOf(selected)}
        options={[
          ...goals.map((goal) => ({
            value: String(goal),
            label: goalLabel(strings.goal, goal),
            testID: `daily-goal-${String(goal)}`,
          })),
          { value: NO_DAILY_GOAL, label: strings.none, testID: 'daily-goal-none' },
        ]}
        selected={selected}
        onSelect={(value) => {
          const goal: DailyGoal | null | undefined =
            value === NO_DAILY_GOAL ? null : goals.find((option) => String(option) === value);
          if (goal === undefined) return;
          setDailyGoal(goal);
        }}
      />
    </SafeAreaView>
  );
}

/** The explaining line of each option, by its value; a goal the Edition's strings don't explain has none. */
const explanations: Readonly<Record<string, string>> = strings.explanations;

function explanationOf(option: string): string {
  return explanations[option] ?? '';
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
