import type { FeedCard } from '@slovo/core';
import { fill, OnboardingMix, OnboardingWelcome, type HeroWord } from '@slovo/ui';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useComposed, useModule } from './composition';
import { editionStrings } from './edition';
import { MixChoices } from './mix-choices';

/** The steps the onboarding has until the SLOVO ID step joins in 0.7. */
const STEPS = 3;

/** Whether the onboarding is on screen: the composition is open and the reader hasn't finished it. */
export function useOnboardingOpen(): boolean {
  return useComposed(
    (composition) => composition.onboarding,
    ({ state }) => state.finishedAt === undefined,
    false,
  );
}

/** The Word the welcome shows: the first Word card the Feed has, which is the Word of the Day. */
function heroOf(cards: readonly FeedCard[]): HeroWord | undefined {
  const word = cards.find((card) => card.kind === 'word');
  if (word === undefined) return undefined;
  const { lemma, stressedVowels, primaryDefinition } = word.wordCard;
  const { stress, stressOr } = editionStrings.wordCard;
  return {
    lemma,
    accessibilityLabel:
      stressedVowels.length === 0
        ? lemma
        : `${lemma}, ${fill(stress, { vowels: stressedVowels.join(` ${stressOr} `) })}`,
    definition: primaryDefinition,
  };
}

/**
 * The onboarding over the Feed, until the reader finishes or skips it. It
 * shows no Feed of its own: the Feed is told no card is on screen while it is
 * open (`useFeed`). Closing the app before it ends leaves it for the next
 * launch.
 */
export function Onboarding() {
  const open = useOnboardingOpen();
  // Modal, so VoiceOver stays out of the Feed and the tabs behind it.
  return open ? (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Steps />
    </View>
  ) : null;
}

/**
 * The steps in order. Mounted only while the onboarding is open, so the Feed's
 * changes don't redraw the closed onboarding. The step the reader is on isn't
 * kept: closing the app halfway starts over at the welcome.
 */
function Steps() {
  const onboarding = useModule((composition) => composition.onboarding);
  const [step, setStep] = useState<'welcome' | 'mix'>('welcome');

  function finish(): void {
    onboarding?.finish().catch((error: unknown) => {
      console.error('Could not keep that the onboarding is finished', error);
    });
  }

  // For now «Далі» finishes the onboarding; the notifications step follows it later.
  return step === 'welcome' ? (
    <WelcomeStep
      onStart={() => {
        setStep('mix');
      }}
      onSkip={finish}
    />
  ) : (
    <OnboardingMix total={STEPS} onNext={finish} onSkip={finish}>
      <MixChoices />
    </OnboardingMix>
  );
}

/** Step 1, with the hero Word. */
function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const cards = useComposed(
    (composition) => composition.feed,
    (feed) => feed.cards,
    noCards,
  );
  const hero = useMemo(() => heroOf(cards), [cards]);

  return <OnboardingWelcome total={STEPS} hero={hero} onStart={onStart} onSkip={onSkip} />;
}

const noCards: readonly FeedCard[] = [];
