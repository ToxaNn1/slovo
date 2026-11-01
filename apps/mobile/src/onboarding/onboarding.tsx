import { DailyGoalSchema, type DailyGoal } from '@slovo/contracts';
import type { OnboardingStep as Step, QuestionnaireOption, WordCardModel } from '@slovo/core';
import {
  EntryCard,
  HEADLINE_MAX_FONT_SCALE,
  LaterButton,
  OnboardingStep,
  OnboardingWelcome,
  OutlineButton,
  PrimaryButton,
  SegmentedControl,
  space,
  stepStyles,
  TEXT_MAX_FONT_SCALE,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';

const { onboarding: strings } = editionStrings;

/** Logs what the onboarding could not do on a tap. */
function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    logError('Could not go on with the onboarding', error);
  });
}

/**
 * The onboarding adapter (ADR 0067): it draws the step the Core onboarding is
 * on, over the Feed, and passes the taps to it. The Core holds the steps,
 * their order, what each answer sets and the rule that ends them.
 */
export function Onboarding() {
  const { onboarding } = useComposition();
  const step = useSubscribed(onboarding, ({ state }) => state.step);
  if (step === undefined) return null;
  const skip = () => {
    report(onboarding.finish());
  };
  const next = () => {
    report(onboarding.next());
  };
  const { number, total } = step;
  let shown: ReactNode;
  if (step.kind === 'welcome') {
    shown = (
      <OnboardingWelcome
        step={number}
        total={total}
        hero={undefined}
        onStart={next}
        onSkip={skip}
      />
    );
  } else if (step.kind === 'firstWord') {
    shown = <FirstWord step={step} word={step.word} onNext={next} onSkip={skip} />;
  } else if (step.kind === 'dailyGoal') {
    shown = (
      <DailyGoalStep
        // A new step on screen starts from the goal it highlights.
        key={step.number}
        step={step}
        highlighted={step.highlighted}
        onDone={(goal) => {
          report(onboarding.chooseDailyGoal(goal));
        }}
        onSkip={skip}
      />
    );
  } else {
    shown = (
      <Question
        key={step.kind}
        step={step}
        title={strings[step.kind].title}
        options={step.options}
        onAnswer={(answerId) => {
          report(onboarding.answer(answerId));
        }}
        onLater={next}
        onSkip={skip}
      />
    );
  }
  return (
    // Modal, so VoiceOver stays out of the Feed and the tabs behind it.
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {shown}
    </View>
  );
}

/** A step's title, read as its header. */
function Title({ children }: { children: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
      style={[stepStyles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
    >
      {children}
    </Text>
  );
}

/** Today's Word of the Day on its card, with its Pronunciation, and «Далі». */
function FirstWord({
  step,
  word,
  onNext,
  onSkip,
}: {
  step: Step;
  word: WordCardModel;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <OnboardingStep
      testID="onboarding-first-word"
      step={step.number}
      total={step.total}
      onSkip={onSkip}
      fromTop
      footer={
        <PrimaryButton testID="onboarding-next" label={strings.firstWord.next} onPress={onNext} />
      }
    >
      <View style={stepStyles.heading}>
        <Title>{strings.firstWord.title}</Title>
      </View>
      <EntryCard card={{ kind: 'word', entryId: word.wordId, model: word }} />
    </OnboardingStep>
  );
}

/** «Хто ви» or «Навіщо»: one button per option, and «Пізніше», which keeps the defaults. */
function Question({
  step,
  title,
  options,
  onAnswer,
  onLater,
  onSkip,
}: {
  step: Step;
  title: string;
  options: readonly QuestionnaireOption[];
  onAnswer: (answerId: string) => void;
  onLater: () => void;
  onSkip: () => void;
}) {
  return (
    <OnboardingStep
      testID="onboarding-question"
      step={step.number}
      total={step.total}
      onSkip={onSkip}
      fromTop
      footer={<LaterButton testID="onboarding-later" onPress={onLater} />}
    >
      <View style={stepStyles.heading}>
        <Title>{title}</Title>
      </View>
      <View style={styles.options}>
        {options.map(({ id, label }) => (
          <OutlineButton
            key={id}
            testID={`onboarding-answer-${id}`}
            label={label}
            onPress={() => {
              onAnswer(id);
            }}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const dailyGoals: readonly DailyGoal[] = DailyGoalSchema.options.map(({ value }) => value);

/** The Daily Goal: the goals in XP, the highlighted one picked, and «Готово», which sets it. */
function DailyGoalStep({
  step,
  highlighted,
  onDone,
  onSkip,
}: {
  step: Step;
  highlighted: DailyGoal;
  onDone: (goal: DailyGoal) => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const [picked, setPicked] = useState(highlighted);
  return (
    <OnboardingStep
      testID="onboarding-daily-goal"
      step={step.number}
      total={step.total}
      onSkip={onSkip}
      fromTop
      footer={
        <PrimaryButton
          testID="onboarding-done"
          label={strings.dailyGoal.done}
          onPress={() => {
            onDone(picked);
          }}
        />
      }
    >
      <View style={stepStyles.heading}>
        <Title>{strings.dailyGoal.title}</Title>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[stepStyles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.dailyGoal.subtitle}
        </Text>
      </View>
      <SegmentedControl
        accessibilityLabel={strings.dailyGoal.title}
        // A segment's value is text, so each Daily Goal is drawn by its number of XP.
        segments={dailyGoals.map((goal) => ({
          value: String(goal),
          label: String(goal),
          testID: `onboarding-daily-goal-${String(goal)}`,
        }))}
        selected={String(picked)}
        onSelect={(value) => {
          const goal = dailyGoals.find((option) => String(option) === value);
          if (goal !== undefined) setPicked(goal);
        }}
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  // The same gap the step puts between its blocks.
  options: { gap: space[3] },
});
