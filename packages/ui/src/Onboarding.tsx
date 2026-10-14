import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DecorBackground, OrnamentBand } from './DecorSlots';
import { fill, useEdition } from './EditionProvider';
import { WholeWordsText } from './WholeWordsText';
import { minTouchTarget, space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** How long a step takes to slide in, and how far from the side it starts. */
const SLIDE_MS = 320;
const SLIDE_DISTANCE = 40;
/**
 * How far the largest text sizes of iOS may scale the step's text, so no word
 * breaks in the middle: the bigger of the two is for running text.
 */
const HEADLINE_MAX_FONT_SCALE = 1.3;
const TEXT_MAX_FONT_SCALE = 1.5;
/** The design's hero Lemma, `Lemma, hero`: Literata 500, 76 / 1. */
const HERO_LEMMA = { fontSize: 76, lineHeight: 76 } as const;
const TITLE_SIZE = 32;
/** A page dot of the progress: the current one is the longer. */
const DOT = { height: 4, width: 16, currentWidth: 44, gap: 12 } as const;

/**
 * One step of the onboarding, over the whole screen: the wordmark and
 * «Пропустити» at the top end, the step's content, the progress dots and the
 * step's buttons. It slides in from the side; with Reduce Motion it appears
 * where it is. VoiceOver reads the step top to bottom and says its number
 * once: with the dots on the welcome, with the overline «КРОК N З M» on the
 * steps after it.
 */
function OnboardingStep({
  step,
  total,
  onSkip,
  children,
  footer,
  testID,
  fromTop = false,
}: {
  /** This step's number, from 1. */
  step: number;
  total: number;
  /** Finishes the onboarding at once. */
  onSkip: () => void;
  children: ReactNode;
  /** The step's buttons, pinned under the content. */
  footer: ReactNode;
  testID?: string;
  /** Whether the content starts under the top row, as the form steps do, instead of sitting on the footer. */
  fromTop?: boolean;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { top, bottom } = useSafeAreaInsets();
  const { onboarding } = strings;
  const numbers = { step: String(step), total: String(total) };

  // Reanimated skips the motion when Reduce Motion is on, so the step just appears.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  // A step after the welcome replaces the one VoiceOver was on: start at its number.
  const overline = useRef<Text>(null);
  useEffect(() => {
    const node = findNodeHandle(overline.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * SLIDE_DISTANCE }],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.step,
        slide,
        { backgroundColor: colors.background, paddingTop: top, paddingBottom: bottom },
      ]}
    >
      <DecorBackground />
      <View style={styles.topRow}>
        <Text
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          numberOfLines={1}
          style={[styles.wordmark, { color: colors.accent, fontFamily: fontFamilies.word }]}
        >
          {strings.splash.wordmark}
        </Text>
        <Pressable
          testID="onboarding-skip"
          accessibilityRole="button"
          {...voice}
          onPress={onSkip}
          hitSlop={space[2]}
          style={styles.skip}
        >
          <Text
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            style={[styles.skipLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {onboarding.skip}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, fromTop && styles.contentFromTop]}
        showsVerticalScrollIndicator={false}
      >
        {step > 1 && (
          <Text
            ref={overline}
            testID="onboarding-step"
            accessibilityLabel={fill(onboarding.stepLabel, numbers)}
            {...voice}
            maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
            style={[styles.overline, { color: colors.accent, fontFamily: fontFamilies.ui }]}
          >
            {fill(onboarding.step, numbers)}
          </Text>
        )}
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <View
          testID="onboarding-progress"
          // The overline says the number on the steps that have one.
          accessible={step === 1}
          accessibilityLabel={fill(onboarding.stepLabel, numbers)}
          {...voice}
          style={styles.dots}
        >
          {Array.from({ length: total }, (_, index) => (
            <View
              key={index}
              style={{
                height: DOT.height,
                width: index + 1 === step ? DOT.currentWidth : DOT.width,
                backgroundColor: index + 1 === step ? colors.accent : colors.line,
              }}
            />
          ))}
        </View>
        {footer}
      </View>
    </Animated.View>
  );
}

/** The step's main button: the Theme's primary fill (design `color.primaryButton`). */
export function PrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, colorScheme, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      {...voice}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        {
          // Dark: the gold of the accent; light: ink.
          backgroundColor: colorScheme === 'dark' ? colors.accent : colors.ink,
          borderRadius: radii.button,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
        style={[styles.primaryLabel, { color: colors.background, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {welcome.title}
      </Text>
      <Text
        {...voice}
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {welcome.subtitle}
      </Text>
    </OnboardingStep>
  );
}

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
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {mix.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {mix.subtitle}
        </Text>
      </View>
      {/* A block of its own: the choices space themselves, not by the step's gap. */}
      <View>{children}</View>
    </OnboardingStep>
  );
}

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
          <Pressable
            testID="onboarding-later"
            accessibilityRole="button"
            {...voice}
            onPress={onLater}
            style={styles.later}
          >
            <Text
              maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
              style={[styles.laterLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {notifications.later}
            </Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {notifications.title}
        </Text>
        <Text
          {...voice}
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
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

const SIDE = space[8];

const styles = StyleSheet.create({
  step: { flex: 1 },
  topRow: {
    minHeight: minTouchTarget + space[4],
    paddingHorizontal: SIDE,
    paddingTop: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 22 * 0.32,
  },
  skip: {
    flexShrink: 0,
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    justifyContent: 'center',
  },
  skipLabel: { fontSize: typeSize.body, fontWeight: '600' },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SIDE,
    paddingTop: space[5],
    gap: space[5],
  },
  contentFromTop: { justifyContent: 'flex-start' },
  overline: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 12 * 0.2,
  },
  heading: { gap: space[2] },
  band: { flexDirection: 'row' },
  hero: { gap: space[2] },
  definition: { fontSize: 22, lineHeight: 22 * 1.3, fontWeight: '500' },
  title: { fontSize: TITLE_SIZE, lineHeight: TITLE_SIZE * 1.15, fontWeight: '500' },
  subtitle: { fontSize: 17, lineHeight: 17 * 1.5, paddingBottom: space[4] },
  footer: { paddingHorizontal: SIDE, paddingTop: space[3], paddingBottom: space[4], gap: space[5] },
  dots: { flexDirection: 'row', alignItems: 'center', gap: DOT.gap },
  primary: {
    minHeight: 56,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  later: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  laterLabel: { fontSize: 16, fontWeight: '600' },
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
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconMark: { fontSize: 22, fontWeight: '600' },
  sampleText: { flex: 1, gap: 2 },
  sampleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3] },
  sampleApp: { flexShrink: 1, fontSize: 13, fontWeight: '600' },
  sampleTime: { fontSize: 13 },
  sampleLemma: { fontSize: 17, lineHeight: 17 * 1.3, fontWeight: '700' },
  sampleBody: { fontSize: 14, lineHeight: 14 * 1.35 },
});
