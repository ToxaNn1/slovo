import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import {
  HEADLINE_MAX_FONT_SCALE,
  HERO_LEMMA,
  OnboardingStep,
  TEXT_MAX_FONT_SCALE,
} from './OnboardingStep';

/** The Word the welcome shows large. */
export interface HeroWord {
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
  readonly definition: string;
}

/**
 * The welcome: what SLOVO is. A hero Word with its Definition,
 * the Edition's promise and «Почати», under the step's shout word. The hero Word is left out when the
 * Language Pack has none to show.
 */
export function OnboardingWelcome({
  step,
  total,
  hero,
  mascot,
  onStart,
  onSkip,
}: {
  /** This step's number, from 1: the Core's order puts the welcome first. */
  step: number;
  total: number;
  hero: HeroWord | undefined;
  /** The on-red Mascot in the step's top, when it shows. */
  mascot?: ReactNode;
  onStart: () => void;
  onSkip: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice, strings } = useEdition();
  const { welcome } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding"
      step={step}
      total={total}
      shout={welcome.shout}
      mascot={mascot}
      onSkip={onSkip}
      footer={<Button testID="onboarding-start" label={welcome.start} onPress={onStart} />}
    >
      {hero === undefined ? null : (
        <View style={styles.hero}>
          <WholeWordsText
            text={hero.lemma}
            size={HERO_LEMMA}
            tracking={-0.02}
            testID="onboarding-hero-lemma"
            accessibilityLabel={hero.accessibilityLabel}
            {...voice}
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[typeStyle('heroLemma', tokens), { color: colors.ink }]}
          />
          <Text
            testID="onboarding-hero-definition"
            {...voice}
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[typeStyle('heroDefinition', tokens), { color: colors.ink }]}
          >
            {hero.definition}
          </Text>
        </View>
      )}
      <Text
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
        style={[typeStyle('stepTitle', tokens), { color: colors.ink }]}
      >
        {welcome.title}
      </Text>
      <Text
        {...voice}
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[typeStyle('stepText', tokens), { color: colors.muted }]}
      >
        {welcome.subtitle}
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space[2] },
});
