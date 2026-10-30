import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { useTokens } from '../providers/TokensProvider';
import {
  HEADLINE_MAX_FONT_SCALE,
  OnboardingStep,
  stepStyles,
  TEXT_MAX_FONT_SCALE,
} from './OnboardingStep';

/**
 * The Mix step. «Оберіть свій Мікс», what it is for, the choices of the Mix
 * (`children`, the shell's: the Mix is the composition's) and «Далі».
 */
export function OnboardingMix({
  step,
  total,
  onNext,
  onSkip,
  children,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  children: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { mix } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding-mix"
      step={step}
      total={total}
      onSkip={onSkip}
      fromTop
      footer={<PrimaryButton testID="onboarding-next" label={mix.next} onPress={onNext} />}
    >
      <View style={stepStyles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[stepStyles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {mix.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[stepStyles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {mix.subtitle}
        </Text>
      </View>
      {/* A block of its own: the choices space themselves, not by the step's gap. */}
      <View>{children}</View>
    </OnboardingStep>
  );
}
