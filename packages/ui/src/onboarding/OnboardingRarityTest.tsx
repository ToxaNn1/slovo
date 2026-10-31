import { useState } from 'react';
import { Text, View } from 'react-native';

import type { Rarity } from '@slovo/contracts';

import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { useTokens } from '../providers/TokensProvider';
import { LaterButton, OnboardingStep, stepStyles, TEXT_MAX_FONT_SCALE } from './OnboardingStep';
import {
  RarityTestQuestions,
  RarityTestTitle,
  type RarityTestQuestion,
} from './RarityTestQuestions';

/**
 * The Rarity Test step, after the Mix: «Перевірити рівень» with «Почати» and
 * the quiet «Пізніше», which goes on past it; «Почати» starts the test
 * (`RarityTestQuestions`), and the result's «Далі» goes on. «Пропустити»
 * finishes the onboarding at any point, setting nothing.
 */
export function OnboardingRarityTest({
  step,
  total,
  words,
  onApply,
  onNext,
  onSkip,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  /** The Words to ask about, in the order asked. */
  words: readonly RarityTestQuestion[];
  /**
   * Applies the answers and resolves to the Rarity Floor they set, or to
   * nothing when none was set; it never rejects.
   */
  onApply: (answers: readonly { rarity: Rarity; known: boolean }[]) => Promise<Rarity | undefined>;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <RarityTestQuestions
        testID="onboarding-rarity"
        words={words}
        onApply={onApply}
        onDone={onNext}
        frame={(screen) => <OnboardingStep step={step} total={total} onSkip={onSkip} {...screen} />}
      />
    );
  }
  return (
    <OnboardingStep
      testID="onboarding-rarity-test"
      step={step}
      total={total}
      onSkip={onSkip}
      footer={
        <>
          <PrimaryButton
            testID="onboarding-rarity-start"
            label={strings.onboarding.welcome.start}
            onPress={() => {
              setStarted(true);
            }}
          />
          <LaterButton testID="onboarding-rarity-later" onPress={onNext} />
        </>
      }
    >
      <View style={stepStyles.heading}>
        <RarityTestTitle>{strings.rarityTest.start}</RarityTestTitle>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[stepStyles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.rarityTest.subtitle}
        </Text>
      </View>
    </OnboardingStep>
  );
}
