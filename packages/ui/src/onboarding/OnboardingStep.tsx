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
  useWindowDimensions,
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
import { HalftoneGround } from '../primitives/HalftoneGround';
import {
  minTouchTarget,
  motion,
  onboardingLayout,
  space,
  roleSize,
  typeStyle,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
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
/** The design's hero Lemma, `Lemma, hero`: the size of its type role. */
export const HERO_LEMMA = roleSize('heroLemma');
/**
 * One step of the onboarding over the whole screen, as the design draws it:
 * the red halftone top cut by a wedge, with the step's shout word, the
 * on-red Mascot and «Пропустити»; under it the step dots, the step's content
 * and its buttons. The step slides in from the side and its shout word flies
 * in from the left; with Reduce Motion both only fade in where they are.
 * VoiceOver starts a step at its dots, which say its number.
 */
export function OnboardingStep({
  step,
  total,
  shout,
  mascot,
  onSkip,
  children,
  footer,
  testID,
}: {
  /** This step's number, from 1. */
  step: number;
  total: number;
  /** The word the step shouts on its red top. */
  shout: string;
  /** The on-red Mascot in the top's corner, when it shows. */
  mascot?: ReactNode;
  /** Finishes the onboarding at once. */
  onSkip: () => void;
  children: ReactNode;
  /** The step's buttons, pinned under the content. */
  footer: ReactNode;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  // The design's black on red is the light Theme's ink in both Themes.
  const inkOnRed = useSchemeColors('light').ink;
  const { voice, strings } = useEdition();
  const { top, bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { onboarding } = strings;

  // With Reduce Motion the step only fades in, so the timing runs whatever the system says.
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(0);
  const fly = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
    const { duration, easing } = reduceMotion ? motion.reduceMotion : motion.fly;
    const [x1, y1, x2, y2] = easing;
    fly.value = withTiming(1, {
      duration,
      easing: Easing.bezier(x1, y1, x2, y2),
      reduceMotion: ReduceMotion.Never,
    });
  }, [progress, fly, reduceMotion]);
  // A step after the welcome replaces the one VoiceOver was on: start at its number.
  const dots = useRef<View>(null);
  useEffect(() => {
    if (step === 1) return;
    const node = findNodeHandle(dots.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [step]);
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: reduceMotion ? 0 : (1 - progress.value) * SLIDE_DISTANCE }],
  }));
  const flyIn = useAnimatedStyle(() => ({
    opacity: Math.min(1, fly.value),
    transform: [
      { translateX: reduceMotion ? 0 : (1 - fly.value) * onboardingLayout.shout.flyFrom },
      { rotate: onboardingLayout.shout.turn },
    ],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[styles.step, slide, { backgroundColor: colors.background, paddingBottom: bottom }]}
    >
      <DecorBackground />
      <View style={styles.hero}>
        <HalftoneGround
          id="onboarding-top"
          width={width}
          height={onboardingLayout.heroHeight}
          points={wedges.cut}
        />
        <Animated.View testID="onboarding-shout" style={[styles.shout, flyIn]}>
          <Text
            accessible={false}
            numberOfLines={1}
            maxFontSizeMultiplier={1}
            style={[typeStyle('stepShout', { fontFamilies }), { color: inkOnRed }]}
          >
            {shout}
          </Text>
        </Animated.View>
        {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
        <View style={[styles.topRow, { paddingTop: top }]}>
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
              style={[typeStyle('quietAction', { fontFamilies }), { color: inkOnRed }]}
            >
              {onboarding.skip}
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          ref={dots}
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
              style={[
                styles.dot,
                {
                  width: index + 1 === step ? dot.currentWidth : dot.width,
                  backgroundColor: index < step ? colors.accent : colors.silhouette,
                },
              ]}
            />
          ))}
        </View>
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </Animated.View>
  );
}

/** The quiet «Пізніше» under a step's main button, which goes on without it. */
export function LaterButton({ testID, onPress }: { testID: string; onPress: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
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
        style={[typeStyle('quietAction', tokens), { color: colors.muted }]}
      >
        {strings.onboarding.notifications.later}
      </Text>
    </Pressable>
  );
}

const { dot, side } = onboardingLayout;

/** The text every step's content shares: the heading block, its title and its text, in the type roles' sizes. */
export const stepStyles = StyleSheet.create({
  heading: { gap: onboardingLayout.gap },
});

const styles = StyleSheet.create({
  step: { flex: 1 },
  hero: { height: onboardingLayout.heroHeight, overflow: 'hidden' },
  shout: {
    position: 'absolute',
    left: onboardingLayout.shout.left,
    top: onboardingLayout.shout.top,
  },
  mascot: {
    position: 'absolute',
    right: onboardingLayout.mascot.right,
    top: onboardingLayout.mascot.top,
  },
  topRow: { paddingHorizontal: side, flexDirection: 'row', justifyContent: 'flex-end' },
  skip: { minHeight: minTouchTarget, minWidth: minTouchTarget, justifyContent: 'center' },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: side,
    paddingTop: onboardingLayout.contentTop,
    gap: onboardingLayout.gap,
  },
  footer: {
    paddingHorizontal: side,
    paddingTop: space[3],
    paddingBottom: onboardingLayout.bottom,
    gap: space[3],
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: dot.gap },
  dot: { height: dot.height, transform: [{ skewX: dot.skew }] },
  later: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});
