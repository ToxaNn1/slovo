import type { OnboardingStep, SampleNotification, WordCardModel } from '@slovo/core';
import {
  OnboardingMix,
  OnboardingNotifications,
  OnboardingWelcome,
  stressLabel,
  type HeroWord,
  type SampleNotificationLook,
} from '@slovo/ui';
import { StyleSheet, View } from 'react-native';

import { useComposed, useModule } from './composition';
import { editionStrings } from './edition';
import { MixChoices } from './mix-choices';
import { NotificationTimes } from './notification-times';

/** A Word's Lemma as the steps draw it: with its Stress, and what VoiceOver reads for it. */
function lemmaOf(wordCard: WordCardModel): { lemma: string; accessibilityLabel: string } {
  return {
    lemma: wordCard.lemma,
    accessibilityLabel: stressLabel(
      editionStrings.wordCard,
      wordCard.lemma,
      wordCard.stressedVowels,
    ),
  };
}

function heroOf(wordCard: WordCardModel | undefined): HeroWord | undefined {
  return wordCard === undefined
    ? undefined
    : { ...lemmaOf(wordCard), definition: wordCard.primaryDefinition };
}

function sampleLookOf(sample: SampleNotification | undefined): SampleNotificationLook | undefined {
  return sample === undefined
    ? undefined
    : { ...lemmaOf(sample.wordCard), body: sample.body, time: sample.time };
}

/** Logs what the onboarding could not do on a tap. */
function report(done: Promise<void>): void {
  done.catch((error: unknown) => {
    console.error('Could not go on with the onboarding', error);
  });
}

/**
 * The onboarding adapter: it draws the step the Core onboarding is on, over
 * the Feed, and passes the taps to it. The Core holds the steps, their order
 * and the rule that ends them.
 */
export function Onboarding() {
  const onboarding = useModule((composition) => composition.onboarding);
  const step = useComposed(
    (composition) => composition.onboarding,
    ({ state }) => state.step,
    undefined,
  );
  if (onboarding === undefined || step === undefined) return null;
  const skip = () => {
    report(onboarding.finish());
  };
  const next = () => {
    report(onboarding.next());
  };
  return (
    // Modal, so VoiceOver stays out of the Feed and the tabs behind it.
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Step
        step={step}
        onNext={next}
        onSkip={skip}
        onAllow={() => {
          report(onboarding.allowNotifications());
        }}
      />
    </View>
  );
}

function Step({
  step,
  onNext,
  onSkip,
  onAllow,
}: {
  step: OnboardingStep;
  onNext: () => void;
  onSkip: () => void;
  onAllow: () => void;
}) {
  const { number, total } = step;
  if (step.kind === 'welcome') {
    return (
      <OnboardingWelcome
        step={number}
        total={total}
        hero={heroOf(step.hero)}
        onStart={onNext}
        onSkip={onSkip}
      />
    );
  }
  if (step.kind === 'mix') {
    return (
      <OnboardingMix step={number} total={total} onNext={onNext} onSkip={onSkip}>
        <MixChoices />
      </OnboardingMix>
    );
  }
  return (
    <OnboardingNotifications
      step={number}
      total={total}
      sample={sampleLookOf(step.sample)}
      onAllow={onAllow}
      // «Пізніше» finishes without asking, as «Пропустити» does.
      onLater={onSkip}
      onSkip={onSkip}
    >
      <NotificationTimes />
    </OnboardingNotifications>
  );
}
