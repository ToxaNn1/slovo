import { DailyGoalSchema, type DailyGoal } from '@slovo/contracts';
import type { LaterQuestion } from '@slovo/core';
import {
  FeedNoticeCard,
  MixChip,
  OutlineButton,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  space,
  useTurnToNextPage,
} from '@slovo/ui';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { editionStrings } from '../edition/edition';
import { useOpenScreen } from '../entries/use-open-screen';
import { useMixState } from '../mix/mix';

const strings = editionStrings.feedNotices.laterQuestions;

const dailyGoals: readonly DailyGoal[] = DailyGoalSchema.options.map(({ value }) => value);

/** The Daily Goal a reader has until they choose one (ADR 0067). */
const DEFAULT_DAILY_GOAL: DailyGoal = 20;

/**
 * The Feed Notice of a later question of the questionnaire (ADR 0067): the
 * Daily Goal, the interests, the self-rating, the Rarity Test offer or the
 * Mix review, each with «Пізніше». An answer applies through the Core's
 * questionnaire, which closes the card for the day, and turns to the next
 * card as a swipe would.
 */
export function LaterQuestionNotice({ question }: { question: LaterQuestion }) {
  const { questionnaire } = useComposition();
  const turnToNext = useTurnToNextPage();
  const openScreen = useOpenScreen();

  function settle(answer: Promise<unknown>, then?: () => void) {
    answer.then(
      () => {
        turnToNext?.();
        then?.();
      },
      (error: unknown) => {
        logError('Could not answer a later question', error);
      },
    );
  }

  const later = (
    <SecondaryButton
      testID={`later-question-${question}-later`}
      label={strings.later}
      onPress={() => {
        settle(questionnaire.later(question));
      }}
    />
  );

  if (question === 'dailyGoalChoice')
    return (
      <DailyGoalQuestion
        later={later}
        onDone={(goal) => {
          settle(questionnaire.chooseDailyGoal(goal));
        }}
      />
    );
  if (question === 'interests')
    return (
      <InterestsQuestion
        later={later}
        onDone={(ids) => {
          settle(questionnaire.chooseInterests(ids));
        }}
      />
    );
  if (question === 'selfRating')
    return (
      <FeedNoticeCard notice={question} title={strings.selfRating.title}>
        <View style={styles.block}>
          {questionnaire.options.selfRating.map(({ id, label }) => (
            <OutlineButton
              key={id}
              testID={`later-question-selfRating-${id}`}
              label={label}
              onPress={() => {
                settle(questionnaire.answer('selfRating', id));
              }}
            />
          ))}
          {later}
        </View>
      </FeedNoticeCard>
    );
  const { title, text } = strings[question];
  return (
    <FeedNoticeCard notice={question} title={title} message={text}>
      <View style={styles.block}>
        <PrimaryButton
          testID={`later-question-${question}-open`}
          label={strings.open}
          onPress={() => {
            settle(questionnaire.open(question), () => {
              openScreen(question === 'rarityTest' ? '/settings/rarity-test' : '/settings/mix');
            });
          }}
        />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

/** The goals in XP, 20 picked until the reader picks another, and «Готово», which sets it. */
function DailyGoalQuestion({
  later,
  onDone,
}: {
  later: ReactNode;
  onDone: (goal: DailyGoal) => void;
}) {
  const [picked, setPicked] = useState(DEFAULT_DAILY_GOAL);
  const { title, text } = strings.dailyGoalChoice;
  return (
    <FeedNoticeCard notice="dailyGoalChoice" title={title} message={text}>
      <View style={styles.block}>
        <SegmentedControl
          accessibilityLabel={title}
          // A segment's value is text, so each Daily Goal is drawn by its number of XP.
          segments={dailyGoals.map((goal) => ({
            value: String(goal),
            label: String(goal),
            testID: `later-question-daily-goal-${String(goal)}`,
          }))}
          selected={String(picked)}
          onSelect={(value) => {
            const goal = dailyGoals.find((option) => String(option) === value);
            if (goal !== undefined) setPicked(goal);
          }}
        />
        <PrimaryButton
          testID="later-question-dailyGoalChoice-done"
          label={strings.done}
          onPress={() => {
            onDone(picked);
          }}
        />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

/**
 * A chip for every Word Category, those in the Mix picked, and «Готово»,
 * which hides every Category not picked. The last picked chip can't be
 * unpicked, as on the Mix screen.
 */
function InterestsQuestion({
  later,
  onDone,
}: {
  later: ReactNode;
  onDone: (categoryIds: readonly string[]) => void;
}) {
  const { allCategories, categoryIds } = useMixState();
  const [picked, setPicked] = useState<readonly string[]>(categoryIds);
  const { title, text } = strings.interests;
  return (
    <FeedNoticeCard notice="interests" title={title} message={text}>
      <View style={styles.block}>
        <View style={styles.chips}>
          {allCategories.map(({ id, displayName }) => {
            const on = picked.includes(id);
            return (
              <MixChip
                key={id}
                testID={`later-question-interest-${id}`}
                label={displayName}
                on={on}
                disabled={on && picked.length === 1}
                onPress={() => {
                  setPicked(on ? picked.filter((other) => other !== id) : [...picked, id]);
                }}
              />
            );
          })}
        </View>
        <PrimaryButton
          testID="later-question-interests-done"
          label={strings.done}
          onPress={() => {
            onDone(picked);
          }}
        />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

const styles = StyleSheet.create({
  block: { gap: space[3], alignSelf: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
