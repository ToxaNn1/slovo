import {
  stressLabel,
  type Account,
  type OnboardingStep,
  type RarityTestAnswer,
  type SampleNotification,
  type WordCardModel,
} from '@slovo/core';
import {
  OnboardingAccount,
  OnboardingMix,
  OnboardingNotifications,
  OnboardingRarityTest,
  OnboardingWelcome,
  type HeroWord,
  type SampleNotificationLook,
} from '@slovo/ui';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAccountScreenGoogle } from '../account/account';
import { AccountScreen } from '../settings/account-screen';
import { useComposition } from '../composition';
import { useShell } from '../shell-value';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { MixChoices } from '../mix/mix-choices';
import { rarityTestQuestionOf, useApplyRarityTest } from '../mix/rarity-test';
import { NotificationTimes } from '../notifications/notification-times';
import { useSubscribed, type Opening } from '../opening';

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
    logError('Could not go on with the onboarding', error);
  });
}

/**
 * The onboarding adapter: it draws the step the Core onboarding is on, over
 * the Feed, and passes the taps to it. The Core holds the steps, their order
 * and the rule that ends them. The SLOVO ID step opens the SLOVO ID screen
 * over itself once the Account is open, and its back link comes back to the
 * step.
 */
export function Onboarding() {
  const { onboarding } = useComposition();
  const accountOpening = useShell().account;
  const applyRarityTest = useApplyRarityTest();
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
  const onStep = (
    <Step
      step={step}
      onNext={next}
      onSkip={skip}
      onApplyRarityTest={applyRarityTest}
      onAllow={() => {
        report(onboarding.allowNotifications());
      }}
      onSignIn={() => {
        // Reading the opening starts it; a failed one opens again.
        const opened = accountOpening?.state;
        if (opened?.status === 'failed') opened.retry();
        setSigningIn(true);
      }}
    />
  );
  return (
    // Modal, so VoiceOver stays out of the Feed and the tabs behind it.
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {signingIn && accountOpening !== undefined ? (
        <AccountOverStep
          opening={accountOpening}
          step={onStep}
          onBack={(account) => {
            setSigningIn(false);
            report(onboarding.backFromAccount(account.state));
          }}
        />
      ) : (
        onStep
      )}
    </View>
  );
}

/**
 * The SLOVO ID screen over the step, once the Account is open; until then the
 * step stays, since the onboarding has no way back from the gate's loading or
 * error state.
 */
function AccountOverStep({
  opening,
  step,
  onBack,
}: {
  opening: Opening<Account>;
  step: ReactNode;
  onBack: (account: Account) => void;
}) {
  const opened = useSubscribed(opening, ({ state }) => state);
  const google = useAccountScreenGoogle();
  if (opened.status !== 'ready') return step;
  return (
    <AccountScreen
      opening={opening}
      google={google}
      // The step it came from, by its title.
      back={{ label: editionStrings.onboarding.account.title, onPress: onBack }}
    />
  );
}

function Step({
  step,
  onNext,
  onSkip,
  onApplyRarityTest,
  onAllow,
  onSignIn,
}: {
  step: OnboardingStep;
  onNext: () => void;
  onSkip: () => void;
  onApplyRarityTest: (answers: readonly RarityTestAnswer[]) => Promise<number | undefined>;
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
  if (step.kind === 'rarityTest') {
    return (
      <OnboardingRarityTest
        step={number}
        total={total}
        words={step.words.map(rarityTestQuestionOf)}
        onApply={onApplyRarityTest}
        onNext={onNext}
        onSkip={onSkip}
      />
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
