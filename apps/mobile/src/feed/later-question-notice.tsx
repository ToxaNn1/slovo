import type { DailyGoal } from '@slovo/contracts';
import type { LaterQuestion } from '@slovo/core';
import {
  FeedNoticeCard,
  Chip,
  AnswerTiles,
  Button,
  SegmentedControl,
  space,
  useTurnToNextPage,
} from '@slovo/ui';
import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useOpenScreen } from '../use-open-screen';
import { useMixState } from '../mix/mix';
import { useShown } from '../shown-in-effect';

const strings = editionStrings.feedNotices.laterQuestions;

/**
 * The Feed Notice of a later question of the questionnaire: the
 * Daily Goal, the interests, the self-rating, the Rarity Test offer or the
 * Mix review, each with «Пізніше». An answer applies through the Core's
 * questionnaire, which closes the card for the day, and turns to the next
 * card as a swipe would.
 */
export function LaterQuestionNotice({ question }: { question: LaterQuestion }) {
  const { questionnaire } = useComposition();
  const turnToNext = useTurnToNextPage();
  const openScreen = useOpenScreen();

  // One answer at a time: a second tap before the first is kept would write it
  // again and turn once more, past the next card once this one closes.
  const settling = useRef(false);

  function settle(answer: () => Promise<unknown>, then?: () => void) {
    if (settling.current) return;
    settling.current = true;
    void keep(
      'the answer to a later question',
      answer().then(() => true),
      false,
    ).then((kept) => {
      // A card that keeps no answer takes the next tap; one that keeps it closes.
      if (!kept) {
        settling.current = false;
        return;
      }
      turnToNext?.();
      then?.();
    });
  }

  const later = (
    <Button
      variant="neutral"
      testID={`later-question-${question}-later`}
      label={strings.later}
      onPress={() => {
        settle(() => questionnaire.later(question));
      }}
    />
  );

  if (question === 'wordGoalChoice')
    return (
      <DailyGoalQuestion
        later={later}
        onDone={(goal) => {
          settle(() => questionnaire.chooseDailyGoal(goal));
        }}
      />
    );
  if (question === 'interests')
    return (
      <InterestsQuestion
        later={later}
        onDone={(ids) => {
          settle(() => questionnaire.chooseInterests(ids));
        }}
      />
    );
  if (question === 'selfRating')
    return (
      <SelfRatingQuestion
        later={later}
        onAnswer={(id) => {
          settle(() => questionnaire.answer('selfRating', id));
        }}
      />
    );
  const { title, text } = strings[question];
  return (
    <FeedNoticeCard notice={question} title={title} message={text} fill>
      <View style={styles.block}>
        <Button
          testID={`later-question-${question}-open`}
          label={strings.open}
          onPress={() => {
            settle(
              () => questionnaire.open(question),
              () => {
                openScreen(question === 'rarityTest' ? '/settings/rarity-test' : '/settings/mix');
              },
            );
          }}
        />
        <View style={styles.foot} />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

/** The Daily Goals in Words, the Edition's highlighted one picked until the reader picks another, and «Готово», which sets it. */
function DailyGoalQuestion({
  later,
  onDone,
}: {
  later: ReactNode;
  onDone: (goal: DailyGoal) => void;
}) {
  const { options: dailyGoals, highlighted } = useEditionInEffect().dailyGoals;
  const [picked, setPicked] = useState(highlighted);
  const { title, text } = strings.wordGoalChoice;
  return (
    <FeedNoticeCard notice="wordGoalChoice" title={title} message={text} fill>
      <View style={styles.block}>
        <SegmentedControl
          accessibilityLabel={title}
          // A segment's value is text, so each Daily Goal is drawn by its number of Words.
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
        <Button
          testID="later-question-wordGoalChoice-done"
          label={strings.done}
          onPress={() => {
            onDone(picked);
          }}
        />
        <View style={styles.foot} />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

/**
 * The self-rating on the tiles of a Game's options (owner, 16.11): a tile
 * pressed is picked and answers at once, and «Пізніше» stays under the tiles.
 */
function SelfRatingQuestion({
  later,
  onAnswer,
}: {
  later: ReactNode;
  onAnswer: (answerId: string) => void;
}) {
  const { questionnaire } = useComposition();
  const [picked, setPicked] = useState<string>();
  return (
    <FeedNoticeCard notice="selfRating" title={strings.selfRating.title} fill>
      <View style={styles.block}>
        <AnswerTiles
          options={questionnaire.options.selfRating.map(({ id, label }) => ({
            id,
            label,
            testID: `later-question-selfRating-${id}`,
          }))}
          picked={picked}
          onPick={(id) => {
            setPicked(id);
            onAnswer(id);
          }}
        />
        <View style={styles.foot} />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

/** The interests question on its Feed Notice: the chips, «Готово» and «Пізніше». */
function InterestsQuestion({
  later,
  onDone,
}: {
  later: ReactNode;
  onDone: (categoryIds: readonly string[]) => void;
}) {
  const { title, text } = strings.interests;
  const { mixPlace } = useShown();
  return (
    <FeedNoticeCard notice="interests" title={title} message={text[mixPlace]} fill>
      <View style={styles.block}>
        <InterestsChoice testIDPrefix="later-question" onDone={onDone} />
        <View style={styles.foot} />
        {later}
      </View>
    </FeedNoticeCard>
  );
}

/**
 * The interests: a chip for every Word Category, those in the Mix picked,
 * and «Готово», which hides every Category not picked. The last picked chip
 * can't be unpicked, as on the Mix screen. For the Feed Notice.
 */
function InterestsChoice({
  testIDPrefix,
  onDone,
}: {
  testIDPrefix: string;
  onDone: (categoryIds: readonly string[]) => void;
}) {
  const { categoryIds } = useMixState();
  const [picked, setPicked] = useState<readonly string[]>(categoryIds);
  return (
    <>
      <InterestChips testIDPrefix={testIDPrefix} picked={picked} onChange={setPicked} />
      <Button
        testID={`${testIDPrefix}-interests-done`}
        label={strings.done}
        onPress={() => {
          onDone(picked);
        }}
      />
    </>
  );
}

/**
 * A chip for every Word Category, those in `picked` on; the last one on can't
 * be turned off. For the Feed Notice and the retake in Settings.
 */
export function InterestChips({
  testIDPrefix,
  picked,
  onChange,
}: {
  testIDPrefix: string;
  picked: readonly string[];
  onChange: (categoryIds: readonly string[]) => void;
}) {
  const { allCategories } = useMixState();
  return (
    <View style={styles.chips}>
      {allCategories.map(({ id, displayName }) => {
        const on = picked.includes(id);
        return (
          <Chip
            key={id}
            testID={`${testIDPrefix}-interest-${id}`}
            label={displayName}
            on={on}
            disabled={on && picked.length === 1}
            onPress={() => {
              onChange(on ? picked.filter((other) => other !== id) : [...picked, id]);
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // The card fills its page as the Quick Question does: the question on top, «Пізніше» at its foot (owner, 16.11).
  block: { flexGrow: 1, gap: space[3], alignSelf: 'stretch' },
  foot: { flexGrow: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
