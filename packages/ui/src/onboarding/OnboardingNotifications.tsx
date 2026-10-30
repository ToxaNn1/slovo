import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { sampleNotification, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import {
  HEADLINE_MAX_FONT_SCALE,
  LaterButton,
  OnboardingStep,
  stepStyles,
  TEXT_MAX_FONT_SCALE,
} from './OnboardingStep';

/** The notification the last step shows as a sample. */
export interface SampleNotificationLook {
  /** The Lemma with its Stress mark. */
  readonly lemma: string;
  /** What VoiceOver reads for the Lemma, which says where the Stress falls. */
  readonly accessibilityLabel: string;
  /** The notification's body: the primary Definition, cut as the real one is. */
  readonly body: string;
  /** When it would come, e.g. «09:00»; left out with no Notification time. */
  readonly time: string | undefined;
}

/**
 * The notifications step. «Слово саме прийде до вас», a sample of the Word of
 * the Day's notification (left out when there is none to show), the Notification
 * times (`children`, the shell's: the times are the Notifications module's),
 * «Дозволити сповіщення» and the quiet «Пізніше».
 */
export function OnboardingNotifications({
  step,
  total,
  sample,
  onAllow,
  onLater,
  onSkip,
  children,
}: {
  /** This step's number, from 1, in the Core's order. */
  step: number;
  total: number;
  sample: SampleNotificationLook | undefined;
  onAllow: () => void;
  onLater: () => void;
  onSkip: () => void;
  children: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { notifications } = strings.onboarding;
  return (
    <OnboardingStep
      testID="onboarding-notifications"
      step={step}
      total={total}
      onSkip={onSkip}
      fromTop
      footer={
        <>
          <PrimaryButton testID="onboarding-allow" label={notifications.allow} onPress={onAllow} />
          <LaterButton testID="onboarding-later" onPress={onLater} />
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
          {notifications.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[stepStyles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {notifications.subtitle}
        </Text>
      </View>
      {sample !== undefined && <SampleNotification sample={sample} />}
      {/* A block of its own: the times space themselves, not by the step's gap. */}
      <View>{children}</View>
    </OnboardingStep>
  );
}

/** What a notification of the app looks like on the lock screen, as a sample of the real one. */
function SampleNotification({ sample }: { sample: SampleNotificationLook }) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice, strings } = useEdition();
  const { wordmark } = strings.splash;
  const label = [
    strings.onboarding.notifications.sample,
    wordmark,
    sample.time,
    sample.accessibilityLabel,
    sample.body,
  ]
    .filter((part) => part !== undefined)
    .join('. ');
  return (
    <View
      testID="onboarding-sample"
      accessible
      accessibilityLabel={label}
      {...voice}
      style={[
        styles.sample,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.card,
          shadowColor: colors.ink,
        },
      ]}
    >
      <View style={[styles.appIcon, { backgroundColor: colors.ink }]}>
        <Text
          style={[styles.appIconMark, { color: colors.background, fontFamily: fontFamilies.word }]}
        >
          {Array.from(wordmark)[0]}
        </Text>
      </View>
      <View style={styles.sampleText}>
        <View style={styles.sampleTop}>
          <Text
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            numberOfLines={1}
            style={[styles.sampleApp, { color: colors.ink, fontFamily: fontFamilies.ui }]}
          >
            {wordmark}
          </Text>
          {sample.time !== undefined && (
            <Text
              testID="onboarding-sample-time"
              maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
              style={[styles.sampleTime, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {sample.time}
            </Text>
          )}
        </View>
        <Text
          testID="onboarding-sample-lemma"
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[styles.sampleLemma, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {sample.lemma}
        </Text>
        <Text
          testID="onboarding-sample-body"
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.sampleBody, { color: colors.inkSecondary, fontFamily: fontFamilies.ui }]}
        >
          {sample.body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sample: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  appIcon: {
    width: sampleNotification.iconSize,
    height: sampleNotification.iconSize,
    borderRadius: sampleNotification.iconRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconMark: { fontSize: typeSize.subhead, fontWeight: '600' },
  sampleText: { flex: 1, gap: sampleNotification.lineGap },
  sampleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  sampleApp: { flexShrink: 1, fontSize: typeSize.meta, fontWeight: '600' },
  sampleTime: { fontSize: typeSize.meta },
  sampleLemma: {
    fontSize: typeSize.blockHeading,
    lineHeight: typeSize.blockHeading * 1.3,
    fontWeight: '600',
  },
  sampleBody: { fontSize: typeSize.caption, lineHeight: typeSize.caption * 1.35 },
});
