'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type HostInstance,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

import { fill, useEdition } from '../providers/EditionProvider';
import { HalftoneGround } from '../primitives/HalftoneGround';
import { WholeWordsText } from '../primitives/WholeWordsText';
import {
  fontScaleCap,
  minTouchTarget,
  motion,
  onboardingLayout,
  space,
  typeStyle,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/** How long a step takes to slide in (ADR 0055). */
const SLIDE_MS = 300;
const { shout: shoutAt } = onboardingLayout;
const SHOUT_TURN = `${String(shoutAt.turn)}deg`;

/**
 * The red top on a screen `width` × `height`: as tall as the board draws it,
 * or shorter so the content keeps the board's room, and shorter still, down
 * to the shortest top that holds its art, so a step's `content` shows whole
 * above its `footer` (the rest scrolls), with its art (the shout
 * word and the Mascot) drawn at the board's size over `artWidth` and scaled
 * by `scale`. The shout word sits low enough that its turned right end stays
 * under «Пропустити», whose row ends at `skipBottom`.
 */
function onboardingHero({
  width,
  height,
  bottom,
  skipBottom,
  content,
  footer,
}: {
  width: number;
  height: number;
  bottom: number;
  skipBottom: number;
  content: number;
  footer: number;
}): { height: number; scale: number; artWidth: number; shoutTop: number } {
  const heroHeight = Math.min(
    onboardingLayout.heroHeight,
    height - bottom - onboardingLayout.contentRoom,
    Math.max(onboardingLayout.minHeroHeight, height - bottom - footer - content),
  );
  const scale = heroHeight / onboardingLayout.heroHeight;
  const artWidth = width / scale;
  // Turned about its middle, the word's right end rises by half its width times the turn's sine.
  const shoutWidth = artWidth - shoutAt.left - onboardingLayout.side;
  const rise = (shoutWidth / 2) * Math.abs(Math.sin((shoutAt.turn * Math.PI) / 180));
  const shoutTop = Math.max(shoutAt.top, skipBottom / scale + rise);
  return { height: heroHeight, scale, artWidth, shoutTop };
}
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
  const { width, height } = useSafeAreaFrame();
  // The content's and the buttons' own heights, once laid out: a taller content gets a shorter red top.
  const [content, setContent] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const hero = onboardingHero({
    width,
    height,
    bottom,
    skipBottom: top + minTouchTarget,
    content,
    footer: footerHeight,
  });
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
  const dots = useRef<HostInstance>(null);
  useEffect(() => {
    if (step === 1) return;
    if (dots.current !== null) AccessibilityInfo.sendAccessibilityEvent(dots.current, 'focus');
  }, [step]);
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: reduceMotion ? 0 : (1 - progress.value) * onboardingLayout.slideDistance },
    ],
  }));
  const flyIn = useAnimatedStyle(() => ({
    opacity: Math.min(1, fly.value),
    transform: [
      { translateX: reduceMotion ? 0 : (1 - fly.value) * shoutAt.flyFrom },
      { rotate: SHOUT_TURN },
    ],
  }));

  return (
    <Animated.View
      testID={testID}
      style={[styles.step, slide, { backgroundColor: colors.background }]}
    >
      <View testID="onboarding-hero" style={[styles.hero, { height: hero.height }]}>
        <HalftoneGround
          id="onboarding-top"
          width={width}
          height={hero.height}
          points={wedges.cut}
        />
        <View
          testID="onboarding-art"
          style={[styles.art, { width: hero.artWidth, transform: [{ scale: hero.scale }] }]}
        >
          <Animated.View
            testID="onboarding-shout"
            style={[styles.shout, { top: hero.shoutTop }, flyIn]}
          >
            {/* Scaled down until the whole word fits across the top, never cut. */}
            <WholeWordsText
              text={shout}
              typeRole="stepShout"
              testID="onboarding-shout-word"
              accessible={false}
              maxFontSizeMultiplier={1}
              style={[typeStyle('stepShout', { fontFamilies }), { color: inkOnRed }]}
            />
          </Animated.View>
          {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
        </View>
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
              maxFontSizeMultiplier={fontScaleCap.number}
              style={[typeStyle('quietAction', { fontFamilies }), { color: inkOnRed }]}
            >
              {onboarding.skip}
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        testID="onboarding-content"
        onContentSizeChange={(_, contentHeight) => {
          setContent(contentHeight);
        }}
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
      {/* Opaque, so content scrolled under the pinned buttons never shows through them. */}
      <View
        testID="onboarding-footer"
        onLayout={({ nativeEvent }) => {
          setFooterHeight(nativeEvent.layout.height);
        }}
        style={[
          styles.footer,
          // The board's room under the buttons, which holds the home indicator.
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(bottom, onboardingLayout.bottom),
          },
        ]}
      >
        {footer}
      </View>
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
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('quietAction', tokens), { color: colors.muted }]}
      >
        {strings.onboarding.later}
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
  hero: { overflow: 'hidden' },
  // The art is laid out at the board's size and scaled from its top left corner.
  art: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: onboardingLayout.heroHeight,
    transformOrigin: 'top left',
  },
  shout: { position: 'absolute', left: shoutAt.left, right: side },
  mascot: {
    position: 'absolute',
    right: onboardingLayout.mascot.right,
    top: onboardingLayout.mascot.top,
  },
  topRow: { paddingHorizontal: side, flexDirection: 'row', justifyContent: 'flex-end' },
  skip: { minHeight: minTouchTarget, minWidth: minTouchTarget, justifyContent: 'center' },
  scroll: { flex: 1 },
  // Never grown to the scroll's height: the step measures how tall its content is.
  content: {
    paddingHorizontal: side,
    paddingTop: onboardingLayout.contentTop,
    gap: onboardingLayout.gap,
  },
  footer: {
    paddingHorizontal: side,
    paddingTop: space[3],
    gap: space[3],
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: dot.gap },
  dot: { height: dot.height, transform: [{ skewX: dot.skew }] },
  later: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});
