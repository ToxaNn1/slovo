import { StyleSheet, Text, View } from 'react-native';

import { EmptyStateIllustration } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { accountMark, onboardingRosetteWidth } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import {
  HEADLINE_MAX_FONT_SCALE,
  OnboardingStep,
  stepStyles,
  TEXT_MAX_FONT_SCALE,
} from './OnboardingStep';

/**
 * The SLOVO ID step, with the Account on: «Збережіть свої слова», what SLOVO
 * ID keeps, the rosette of the empty states (Decor slot 4), «Увійти через
 * SLOVO ID» with SLOVO ID's mark, which opens the SLOVO ID screen, and
 * «Продовжити без акаунта».
 */
export function OnboardingAccount({
  step,
  total,
  accountName,
  onSignIn,
  onContinue,
  onSkip,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  /** What the Edition calls the Account. */
  accountName: string;
  onSignIn: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { account } = strings.onboarding;
  const name = { name: accountName };
  return (
    <OnboardingStep
      testID="onboarding-account"
      step={step}
      total={total}
      onSkip={onSkip}
      fromTop
      footer={
        <>
          <PrimaryButton
            testID="onboarding-sign-in"
            label={fill(account.signIn, name)}
            mark={<AccountMark letter={Array.from(accountName)[0] ?? ''} />}
            onPress={onSignIn}
          />
          <SecondaryButton
            testID="onboarding-continue"
            label={account.continueWithout}
            onPress={onContinue}
          />
        </>
      }
    >
      <View style={stepStyles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[stepStyles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {account.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[stepStyles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {fill(account.subtitle, name)}
        </Text>
      </View>
      <View style={styles.rosette}>
        <EmptyStateIllustration width={onboardingRosetteWidth} />
      </View>
    </OnboardingStep>
  );
}

/** The Account's mark: its first letter on the background colour, inside the primary button's ink fill. */
function AccountMark({ letter }: { letter: string }) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View style={[styles.accountMark, { backgroundColor: colors.background }]}>
      <Text
        allowFontScaling={false}
        style={[styles.accountMarkLetter, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rosette: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  accountMark: {
    width: accountMark.size,
    height: accountMark.size,
    borderRadius: accountMark.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMarkLetter: { fontSize: accountMark.letterSize, fontWeight: '600' },
});
