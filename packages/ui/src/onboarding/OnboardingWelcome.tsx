import { StyleSheet, Text, View } from 'react-native';

import { OrnamentBand } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import {
  HEADLINE_MAX_FONT_SCALE,
  HERO_LEMMA,
  OnboardingStep,
  stepStyles,
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
 * The welcome: what SLOVO is. A hero Word with its Definition, the ornament band,
 * the Edition's promise and «Почати». The hero Word is left out when the
 * Language Pack has none to show.
 */
export function OnboardingWelcome({
  step,
  total,
  hero,
  onStart,
  onSkip,
}: {
  /** This step's number, from 1: the Core's order puts the welcome first. */
  step: number;
  total: number;
  hero: HeroWord | undefined;
  onStart: () => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { welcome } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding"
      step={step}
      total={total}
      onSkip={onSkip}
      footer={<PrimaryButton testID="onboarding-start" label={welcome.start} onPress={onStart} />}
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
            style={{ color: colors.ink, fontFamily: fontFamilies.word, fontWeight: '500' }}
          />
          <Text
            testID="onboarding-hero-definition"
            {...voice}
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[
              styles.definition,
              { color: colors.inkSecondary, fontFamily: fontFamilies.word },
            ]}
          >
            {hero.definition}
          </Text>
        </View>
      )}
      {/* In a row, since the band fills the width with `flex`. */}
      <View style={styles.band}>
        <OrnamentBand />
      </View>
      <Text
        accessibilityRole="header"
        {...voice}
        maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
        style={[stepStyles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {welcome.title}
      </Text>
      <Text
        {...voice}
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[stepStyles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {welcome.subtitle}
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row' },
  hero: { gap: space[2] },
  definition: { fontSize: typeSize.subhead, lineHeight: typeSize.subhead * 1.3, fontWeight: '500' },
});
