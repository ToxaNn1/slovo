import type { DailyGoal, MascotState } from '@slovo/contracts';
import type { OnboardingStep as Step, QuestionnaireOption, WordCardModel } from '@slovo/core';
import {
  EntryCard,
  HEADLINE_MAX_FONT_SCALE,
  LaterButton,
  OnboardingStep,
  OnboardingWelcome,
  Button,
  onboardingLayout,
  PressedTile,
  RarityTestQuestions,
  space,
  stepStyles,
  TEXT_MAX_FONT_SCALE,
  typeStyle,
  useEdition,
  useTokens,
  type RarityTestQuestion,
} from '@slovo/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MascotAs } from '../mascot/mascot';
import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';
import { rarityTestQuestionOf, useApplyRarityTest } from '../mix/rarity-test';

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
  // The design draws the Mascot without a line, in each step's own state.
  const mascot = (
    <MascotAs state={mascotState[step.kind]} onRed width={onboardingLayout.mascot.width} />
  );
  let shown: ReactNode;
  if (step.kind === 'welcome') {
    shown = (
      <OnboardingWelcome
        step={number}
        total={total}
        hero={undefined}
        mascot={mascot}
        onStart={next}
        onSkip={skip}
      />
    );
  } else if (step.kind === 'firstWord') {
    shown = <FirstWord step={step} word={step.word} mascot={mascot} onNext={next} onSkip={skip} />;
  } else if (step.kind === 'playStep') {
    shown = <PlayStep step={step} mascot={mascot} onNext={next} onSkip={skip} />;
  } else if (step.kind === 'dailyGoal') {
    shown = (
      <DailyGoalStep
        // A new step on screen starts from the goal it highlights.
        key={step.number}
        step={step}
        goals={step.goals}
        highlighted={step.highlighted}
        mascot={mascot}
        onDone={(goal) => {
          report(onboarding.chooseDailyGoal(goal));
        }}
        onSkip={skip}
      />
    );
  } else if (step.kind === 'rarityTest') {
    shown = <RarityTestStep step={step} mascot={mascot} onSkip={skip} />;
  } else {
    shown = (
      <Question
        key={step.kind}
        step={step}
        title={strings[step.kind].title}
        shout={strings[step.kind].shout}
        options={step.options}
        mascot={mascot}
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

/** The Mascot's state on each step, as the design poses it. */
const mascotState: Readonly<Record<Step['kind'], MascotState>> = {
  welcome: 'shouts',
  firstWord: 'happy',
  playStep: 'happy',
  level: 'waits',
  rarityTest: 'waits',
  why: 'waits',
  dailyGoal: 'waits',
};

/** A step's title, read as its header. */
function Title({ children }: { children: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <Text
      accessibilityRole="header"
      {...voice}
      maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
      style={[typeStyle('stepTitle', tokens), { color: colors.ink }]}
    >
      {children}
    </Text>
  );
}

/** Today's Word of the Day on its card, with its Pronunciation, and «Далі». */
function FirstWord({
  step,
  word,
  mascot,
  onNext,
  onSkip,
}: {
  step: Step;
  word: WordCardModel;
  mascot: ReactNode;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <OnboardingStep
      testID="onboarding-first-word"
      step={step.number}
      total={step.total}
      shout={strings.firstWord.shout}
      mascot={mascot}
      onSkip={onSkip}
      footer={<Button testID="onboarding-next" label={strings.firstWord.next} onPress={onNext} />}
    >
      <View style={stepStyles.heading}>
        <Title>{strings.firstWord.title}</Title>
      </View>
      <EntryCard card={{ kind: 'word', entryId: word.wordId, model: word }} />
    </OnboardingStep>
  );
}

/** A step's line under its title, in the Edition's voice. */
function Subtitle({ children }: { children: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <Text
      {...voice}
      maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
      style={[typeStyle('stepText', tokens), { color: colors.muted }]}
    >
      {children}
    </Text>
  );
}

/** «ГРАЙ!»: the Games in one screen, and «Далі». */
function PlayStep({
  step,
  mascot,
  onNext,
  onSkip,
}: {
  step: Step;
  mascot: ReactNode;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <OnboardingStep
      testID="onboarding-play"
      step={step.number}
      total={step.total}
      shout={strings.playStep.shout}
      mascot={mascot}
      onSkip={onSkip}
      footer={<Button testID="onboarding-next" label={strings.playStep.next} onPress={onNext} />}
    >
      <View style={stepStyles.heading}>
        <Title>{strings.playStep.title}</Title>
        <Subtitle>{strings.playStep.subtitle}</Subtitle>
      </View>
    </OnboardingStep>
  );
}

/**
 * The Rarity Test that «Не знаю» on «Рівень» opens, in the frame of that
 * step: drawn afresh from the Mix, its result sets the Rarity Ceiling and
 * «Далі» goes on. A draw with no Word, or one that fails, goes on at once.
 */
function RarityTestStep({
  step,
  mascot,
  onSkip,
}: {
  step: Step;
  mascot: ReactNode;
  onSkip: () => void;
}) {
  const { rarityTest, onboarding } = useComposition();
  const applyRarityTest = useApplyRarityTest();
  const [words, setWords] = useState<readonly RarityTestQuestion[]>();
  useEffect(() => {
    let open = true;
    const onDone = () => {
      report(onboarding.next());
    };
    rarityTest
      .draw()
      .then((drawn) => {
        if (!open) return;
        if (drawn.length === 0) onDone();
        else setWords(drawn.map(rarityTestQuestionOf));
      })
      .catch((error: unknown) => {
        logError('Could not draw the Rarity Test', error);
        if (open) onDone();
      });
    return () => {
      open = false;
    };
  }, [rarityTest, onboarding]);
  const done = () => {
    report(onboarding.next());
  };

  const frame = ({
    testID,
    footer,
    children,
  }: {
    testID: string;
    footer: ReactNode;
    children: ReactNode;
  }) => (
    <OnboardingStep
      testID={testID}
      step={step.number}
      total={step.total}
      shout={strings.level.shout}
      mascot={mascot}
      onSkip={onSkip}
      footer={footer}
    >
      {children}
    </OnboardingStep>
  );
  if (words === undefined)
    return frame({ testID: 'onboarding-rarity', footer: null, children: null });
  return (
    <RarityTestQuestions
      testID="onboarding-rarity"
      words={words}
      onApply={applyRarityTest}
      onDone={done}
      frame={frame}
    />
  );
}

/** «Рівень» or «Навіщо»: one button per option, and «Пізніше», which keeps the defaults. */
function Question({
  step,
  title,
  shout,
  options,
  mascot,
  onAnswer,
  onLater,
  onSkip,
}: {
  step: Step;
  title: string;
  shout: string;
  options: readonly QuestionnaireOption[];
  mascot: ReactNode;
  onAnswer: (answerId: string) => void;
  onLater: () => void;
  onSkip: () => void;
}) {
  return (
    <OnboardingStep
      testID="onboarding-question"
      step={step.number}
      total={step.total}
      shout={shout}
      mascot={mascot}
      onSkip={onSkip}
      footer={null}
    >
      <View style={stepStyles.heading}>
        <Title>{title}</Title>
      </View>
      <View style={styles.options}>
        {options.map(({ id, label }) => (
          <Button
            size="small"
            variant="neutral"
            key={id}
            testID={`onboarding-answer-${id}`}
            label={label}
            onPress={() => {
              onAnswer(id);
            }}
          />
        ))}
        <LaterButton testID="onboarding-later" onPress={onLater} />
      </View>
    </OnboardingStep>
  );
}

/** The Daily Goal: a tile per goal in Words, the highlighted one picked, and «Готово», which sets it. */
function DailyGoalStep({
  step,
  goals,
  highlighted,
  mascot,
  onDone,
  onSkip,
}: {
  step: Step;
  goals: readonly DailyGoal[];
  highlighted: DailyGoal;
  mascot: ReactNode;
  onDone: (goal: DailyGoal) => void;
  onSkip: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const [picked, setPicked] = useState(highlighted);
  return (
    <OnboardingStep
      testID="onboarding-daily-goal"
      step={step.number}
      total={step.total}
      shout={strings.dailyGoal.shout}
      mascot={mascot}
      onSkip={onSkip}
      footer={
        <Button
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
        <Subtitle>{strings.dailyGoal.subtitle}</Subtitle>
      </View>
      <View style={styles.goals}>
        {goals.map((goal) => {
          const selected = goal === picked;
          const ink = selected ? colors.onAccent : colors.ink;
          return (
            <View key={goal} style={styles.goal}>
              <PressedTile
                testID={`onboarding-daily-goal-${String(goal)}`}
                tone={selected ? 'accent' : 'tile'}
                radius={onboardingLayout.goalTile.radius}
                accessibilityLabel={`${String(goal)} ${strings.dailyGoal.unit}`}
                accessibilityState={{ selected }}
                faceStyle={styles.goalFace}
                onPress={() => {
                  setPicked(goal);
                }}
              >
                <Text
                  maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
                  style={[typeStyle('goalNumber', tokens), { color: ink }]}
                >
                  {String(goal)}
                </Text>
                <Text
                  maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
                  style={[typeStyle('goalUnit', tokens), { color: ink }]}
                >
                  {strings.dailyGoal.unit}
                </Text>
              </PressedTile>
            </View>
          );
        })}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  // The same gap the step puts between its blocks.
  options: { gap: space[3] },
  goals: { flexDirection: 'row', gap: onboardingLayout.goalTile.gap },
  goal: { flex: 1 },
  goalFace: {
    height: onboardingLayout.goalTile.height,
    alignItems: 'center',
    justifyContent: 'center',
    gap: onboardingLayout.goalTile.lineGap,
  },
});
