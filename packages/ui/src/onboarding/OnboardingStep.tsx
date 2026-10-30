'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

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
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DecorBackground } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { minTouchTarget, overlineType, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/** How long a step takes to slide in (ADR 0055), and how far from the side it starts. */
const SLIDE_MS = 300;
const SLIDE_DISTANCE = 40;
/**
 * How far the largest text sizes of iOS may scale the step's text, so no word
 * breaks in the middle: the bigger of the two is for running text.
 */
export const HEADLINE_MAX_FONT_SCALE = 1.3;
export const TEXT_MAX_FONT_SCALE = 1.5;
/** The design's hero Lemma, `Lemma, hero`: Literata 500, 76 / 1. */
export const HERO_LEMMA = { fontSize: typeSize.heroLemma, lineHeight: typeSize.heroLemma } as const;
/** A page dot of the progress: the current one is the longer. */
const DOT = { height: 4, width: 16, currentWidth: 44, gap: space[3] } as const;

/**
 * One step of the onboarding, over the whole screen: the wordmark and
 * «Пропустити» at the top end, the step's content, the progress dots and the
 * step's buttons. It slides in from the side; with Reduce Motion it fades in
 * where it is. VoiceOver reads the step top to bottom and says its number
 * once: with the dots on the welcome, with the overline «КРОК N З M» on the
 * steps after it.
 */
export function OnboardingStep({
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

  // With Reduce Motion the step only fades in, so the timing runs whatever the system says.
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [progress]);
  // A step after the welcome replaces the one VoiceOver was on: start at its number.
  const overline = useRef<Text>(null);
  useEffect(() => {
    const node = findNodeHandle(overline.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - progress.value) * SLIDE_DISTANCE }],
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

/** The quiet «Пізніше» under a step's main button, which goes on without it. */
export function LaterButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { voice, strings } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      {...voice}
      onPress={onPress}
      style={styles.later}
    >
      <Text
        maxFontSizeMultiplier={HEADLINE_MAX_FONT_SCALE}
        style={[styles.laterLabel, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {strings.onboarding.notifications.later}
      </Text>
    </Pressable>
  );
}

const SIDE = space[8];

/** The text every step's content shares: the heading block, its title and its subtitle. */
export const stepStyles = StyleSheet.create({
  heading: { gap: space[2] },
  title: {
    fontSize: typeSize.onboardingTitle,
    lineHeight: typeSize.onboardingTitle * 1.15,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: typeSize.blockHeading,
    lineHeight: typeSize.blockHeading * 1.5,
    paddingBottom: space[4],
  },
});

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
    fontSize: typeSize.subhead,
    fontWeight: '500',
    letterSpacing: typeSize.subhead * 0.32,
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
  overline: overlineType,
  footer: { paddingHorizontal: SIDE, paddingTop: space[3], paddingBottom: space[4], gap: space[5] },
  dots: { flexDirection: 'row', alignItems: 'center', gap: DOT.gap },
  later: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  laterLabel: { fontSize: typeSize.button, fontWeight: '600' },
});
