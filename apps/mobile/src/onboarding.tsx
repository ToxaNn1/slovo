import type { OnboardingStep, SampleNotification, WordCardModel } from '@slovo/core';
import {
  OnboardingAccount,
  OnboardingMix,
  OnboardingNotifications,
  OnboardingWelcome,
  stressLabel,
  type HeroWord,
  type SampleNotificationLook,
} from '@slovo/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccountScreen } from './account/account-screen';
import { accountOpening } from './account/device-account';
import { useComposition } from './composition';
import { editionStrings } from './edition/edition';
import { MixChoices } from './mix/mix-choices';
import { NotificationTimes } from './notifications/notification-times';
import { useSubscribed } from './opening';

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
 * and the rule that ends them. The SLOVO ID step opens the SLOVO ID screen
 * over itself, and its back link comes back to the step.
 */
export function Onboarding() {
  const { onboarding } = useComposition();
  const step = useSubscribed(onboarding, ({ state }) => state.step);
  /** Whether the SLOVO ID screen is open over the step. */
  const [signingIn, setSigningIn] = useState(false);
  if (step === undefined) return null;
  const skip = () => {
    report(onboarding.finish());
  };
  const next = () => {
    report(onboarding.next());
  };
  return (
    // Modal, so VoiceOver stays out of the Feed and the tabs behind it.
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {signingIn && accountOpening !== undefined ? (
        <AccountScreen
          opening={accountOpening}
          back={{
            // The step it came from, by its title.
            label: editionStrings.onboarding.account.title,
            onPress: (account) => {
              setSigningIn(false);
              report(onboarding.backFromAccount(account.state));
            },
          }}
        />
      ) : (
        <Step
          step={step}
          onNext={next}
          onSkip={skip}
          onAllow={() => {
            report(onboarding.allowNotifications());
          }}
          onSignIn={() => {
            setSigningIn(true);
          }}
        />
      )}
    </View>
  );
}

function Step({
  step,
  onNext,
  onSkip,
  onAllow,
  onSignIn,
}: {
  step: OnboardingStep;
  onNext: () => void;
  onSkip: () => void;
  onAllow: () => void;
  onSignIn: () => void;
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
  if (step.kind === 'notifications') {
    return (
      <OnboardingNotifications
        step={number}
        total={total}
        sample={sampleLookOf(step.sample)}
        onAllow={onAllow}
        // «Пізніше» goes on without asking.
        onLater={onNext}
        onSkip={onSkip}
      >
        <NotificationTimes />
      </OnboardingNotifications>
    );
  }
  return (
    <OnboardingAccount
      step={number}
      total={total}
      onSignIn={onSignIn}
      // «Продовжити без акаунта» goes on past the last step, which finishes.
      onContinue={onNext}
      onSkip={onSkip}
    />
  );
}
