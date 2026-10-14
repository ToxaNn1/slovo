import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
 * with the dots.
 */
export function OnboardingStep({
  step,
  total,
  onSkip,
  children,
  footer,
  testID,
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
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  const { top, bottom } = useSafeAreaInsets();
  const { onboarding } = strings;

  // Reanimated skips the motion when Reduce Motion is on, so the step just appears.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
  }, [progress]);
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <View style={styles.footer}>
        <View
          testID="onboarding-progress"
          accessible
          accessibilityLabel={fill(onboarding.stepLabel, {
            step: String(step),
            total: String(total),
          })}
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
 * Step 1: what SLOVO is. A hero Word with its Definition, the ornament band,
 * the Edition's promise and «Почати». The hero Word is left out when the
 * Language Pack has none to show.
 */
export function OnboardingWelcome({
  total,
  hero,
  onStart,
  onSkip,
}: {
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
      step={1}
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
});
