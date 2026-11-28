'use no memo';
// Reanimated or gesture code: the React Compiler skips this module.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type HostInstance,
  type ViewProps,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { fill, useEdition } from '../providers/EditionProvider';
import { HalftoneGround } from '../primitives/HalftoneGround';
import { WholeWordsText } from '../primitives/WholeWordsText';
import {
  capitalMarkRoom,
  fontScaleCap,
  minTouchTarget,
  motion,
  onboardingLayout,
  roleSize,
  space,
  typeStyle,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';

/** How long a step takes to slide in. */
const SLIDE_MS = 300;
const { shout: shoutAt, intro, dot, side } = onboardingLayout;
const SHOUT_TURN = `${String(shoutAt.turn)}deg`;

/**
 * The red top on a screen `width` × `height`: as tall as the board draws it,
 * or shorter so the content keeps the board's room, and shorter still, down
 * to the shortest top that holds its art, so a step's `content` shows whole
 * above its `footer` (the rest scrolls), with its art (the shout
 * word and the Mascot) drawn at the board's size over `artWidth` and scaled
 * by `scale`. The shout word sits low enough that its turned right end, with
 * the capitals' marks over its line (`shoutRoom`), stays under «Пропустити»,
 * whose row ends at `skipBottom`.
 */
function onboardingHero({
  width,
  height,
  bottom,
  skipBottom,
  shoutRoom,
  content,
  footer,
}: {
  width: number;
  height: number;
  bottom: number;
  skipBottom: number;
  shoutRoom: number;
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
  return {
    height: heroHeight,
    scale,
    artWidth,
    shoutTop: shoutTopIn(artWidth, skipBottom / scale + shoutRoom),
  };
}

/**
 * Where the shout word sits on art `artWidth` wide: the board's place, or
 * lower so its turned right end stays under «Пропустити», whose row ends
 * `skipBottom` below the art's top (with the room the capitals' marks take
 * over the word's line), both at the board's size.
 */
function shoutTopIn(artWidth: number, skipBottom: number): number {
  // Turned about its middle, the word's right end rises by half its width times the turn's sine.
  const shoutWidth = artWidth - shoutAt.left - onboardingLayout.side;
  const rise = (shoutWidth / 2) * Math.abs(Math.sin((shoutAt.turn * Math.PI) / 180));
  return Math.max(shoutAt.top, skipBottom + rise);
}

/**
 * The first Word's red top over the whole screen, `width` × `height`, down to
 * the step's dots, which stay in sight: how tall it is, the band it gives way
 * to at the top, which holds «Пропустити» over the wedge's cut, how far it
 * travels up, and its art at the board's size or smaller, in its middle.
 */
function introCover({
  width,
  height,
  top,
  bottom,
  shoutRoom,
}: {
  width: number;
  height: number;
  top: number;
  bottom: number;
  shoutRoom: number;
}) {
  const skipBottom = top + minTouchTarget;
  const band = skipBottom + intro.cut;
  const dotsRoom =
    onboardingLayout.contentTop + dot.height + Math.max(bottom, onboardingLayout.bottom);
  const cover = Math.max(band, height - dotsRoom);
  const scale = Math.min(1, cover / onboardingLayout.heroHeight);
  const artWidth = width / scale;
  const artTop = (cover - onboardingLayout.heroHeight * scale) / 2;
  return {
    cover,
    band,
    travel: cover - band,
    scale,
    artWidth,
    artTop,
    shoutTop: shoutTopIn(artWidth, (skipBottom - artTop) / scale + shoutRoom),
    // The board's cut, its depth kept at `intro.cut` points however tall the red is.
    points: [
      [0, 0],
      [1, 0],
      [1, 1 - intro.cut / cover],
      [0, 1],
    ] as const,
  };
}

/** The red gives way to its band, after `delay` ms; `done` runs once it is there. */
function giveWay(open: SharedValue<number>, done: (value: boolean) => void, delay = 0) {
  const [x1, y1, x2, y2] = motion.screen.easing;
  open.value = withDelay(
    delay,
    withTiming(
      1,
      {
        duration: intro.giveWay,
        easing: Easing.bezier(x1, y1, x2, y2),
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        'worklet';
        if (finished === true) scheduleOnRN(done, true);
      },
    ),
  );
}
/**
 * One step of the onboarding over the whole screen, as the design draws it:
 * the red halftone top cut by a wedge, with the step's shout word, the
 * on-red Mascot and «Пропустити»; under it the step dots, the step's content
 * and its buttons. The step slides in from the side and its shout word flies
 * in from the left; with Reduce Motion both only fade in where they are.
 * VoiceOver starts a step at its dots, which say its number. A `framed`
 * step's content never scrolls: it takes the whole room under the red top,
 * kept at its shortest, for a card in its fixed frame that scrolls inside
 * itself. An `intro` step (the first Word's) opens on its red top over the
 * whole screen, its dots under it; after its shout word has flown in and
 * held, or at a tap, the red gives way up to a band with «Пропустити» and
 * the content rises after its edge, its framed card in the room the Feed
 * gives a card, the buttons last. With Reduce Motion it opens at once.
 */
export function OnboardingStep({
  step,
  total,
  shout,
  mascot,
  onSkip,
  children,
  footer,
  framed = false,
  intro: introStep = false,
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
  /** The content takes the room under the red top and never scrolls, for the first Word's card. */
  framed?: boolean;
  /** Opens on the red top over the whole screen, which gives way to the framed content. */
  intro?: boolean;
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
  // How far the shout word is shrunk to fit across the top, from its height as drawn (a word
  // that wraps counts as unshrunk): the marks over its capitals rise above it in proportion.
  const shoutSize = roleSize('stepShout');
  const [shoutHeight, setShoutHeight] = useState(shoutSize.lineHeight);
  const shoutRatio = Math.min(1, shoutHeight / shoutSize.lineHeight);
  const shoutRoom = capitalMarkRoom('stepShout', {
    fontSize: shoutSize.fontSize * shoutRatio,
    lineHeight: shoutSize.lineHeight * shoutRatio,
  });
  const hero = onboardingHero({
    width,
    height,
    bottom,
    skipBottom: top + minTouchTarget,
    shoutRoom,
    // A framed step's content takes whatever room there is: the red top stays its shortest.
    content: framed ? Number.POSITIVE_INFINITY : content,
    footer: footerHeight,
  });
  const { onboarding } = strings;

  // With Reduce Motion the step only fades in, so the timing runs whatever the system says.
  const known = useReduceMotionKnown();
  const reduceMotion = known === true;
  const progress = useSharedValue(0);
  const fly = useSharedValue(0);
  // A step after the welcome replaces the one VoiceOver was on: start at its number, once the
  // step has slid in, as VoiceOver cannot land on a view that is still clear.
  const [slidIn, setSlidIn] = useState(false);
  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: SLIDE_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never },
      (finished) => {
        'worklet';
        if (finished === true) scheduleOnRN(setSlidIn, true);
      },
    );
  }, [progress]);
  const dots = useRef<HostInstance>(null);
  useEffect(() => {
    if (!slidIn || step === 1) return;
    if (dots.current !== null) AccessibilityInfo.sendAccessibilityEvent(dots.current, 'focus');
  }, [slidIn, step]);
  // The shout word waits for the system's answer, so it never begins its full flight under Reduce Motion.
  useEffect(() => {
    if (known === undefined) return;
    const { duration, easing } = known ? motion.reduceMotion : motion.fly;
    const [x1, y1, x2, y2] = easing;
    fly.value = withTiming(1, {
      duration,
      easing: Easing.bezier(x1, y1, x2, y2),
      reduceMotion: ReduceMotion.Never,
    });
  }, [fly, known]);
  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: reduceMotion ? 0 : (1 - progress.value) * onboardingLayout.slideDistance },
    ],
  }));
  // The intro: 0 while the red covers the screen, 1 once it has given way to its band.
  const cover = introCover({ width, height, top, bottom, shoutRoom });
  const open = useSharedValue(introStep ? 0 : 1);
  const [givenWay, setGivenWay] = useState(false);
  const opened = !introStep || givenWay || known === true;
  // Under the red, the content and the buttons stay out of reach of VoiceOver.
  const underCover: Pick<ViewProps, 'accessibilityElementsHidden' | 'importantForAccessibility'> = {
    accessibilityElementsHidden: !opened,
    importantForAccessibility: opened ? 'auto' : 'no-hide-descendants',
  };
  useEffect(() => {
    if (!introStep || known === undefined) return;
    if (known) open.value = 1;
    else giveWay(open, setGivenWay, motion.fly.duration + intro.hold);
  }, [introStep, known, open]);
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -open.value * cover.travel }],
  }));
  const follow = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.value) * cover.travel }],
  }));
  // The heading and the card come out from under the red's edge as it rises.
  const reveal = useAnimatedStyle(() => ({ opacity: open.value }));
  // The buttons last, in the give-way's second half.
  const buttons = useAnimatedStyle(() => ({
    opacity: Math.max(0, 2 * open.value - 1),
    transform: [{ translateY: (1 - open.value) * motion.cascade.rise }],
  }));

  const flyIn = useAnimatedStyle(() => ({
    opacity: Math.min(1, fly.value),
    transform: [
      { translateX: known === false ? (1 - fly.value) * shoutAt.flyFrom : 0 },
      { rotate: SHOUT_TURN },
    ],
  }));

  // The step's dots over its content.
  const body = (
    <>
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
      {introStep ? (
        <Animated.View style={[styles.revealed, reveal]}>{children}</Animated.View>
      ) : (
        children
      )}
    </>
  );

  const art = (at: { artWidth: number; scale: number; shoutTop: number; top?: number }) => (
    <View
      testID="onboarding-art"
      style={[
        styles.art,
        { width: at.artWidth, top: at.top ?? 0, transform: [{ scale: at.scale }] },
      ]}
    >
      <Animated.View
        testID="onboarding-shout"
        onLayout={({ nativeEvent }) => {
          if (nativeEvent.layout.height > 0) setShoutHeight(nativeEvent.layout.height);
        }}
        style={[styles.shout, { top: at.shoutTop }, flyIn]}
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
  );

  const skipRow = (
    <View style={[styles.topRow, { paddingTop: top }]}>
      <Pressable
        testID="onboarding-skip"
        accessibilityRole="button"
        accessibilityLabel={onboarding.skip}
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
  );

  // Opaque, so content scrolled under the pinned buttons never shows through them.
  const footerBar = (
    <Animated.View
      testID="onboarding-footer"
      {...underCover}
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
        introStep && buttons,
      ]}
    >
      {footer}
    </Animated.View>
  );

  if (introStep)
    return (
      <Animated.View
        testID={testID}
        style={[styles.step, styles.clipped, slide, { backgroundColor: colors.background }]}
      >
        {/* The band the red leaves at the top, which the red itself draws. */}
        <View style={{ height: cover.band }} />
        <Animated.View
          testID="onboarding-content"
          {...underCover}
          style={[styles.content, styles.framed, follow]}
        >
          {body}
        </Animated.View>
        {footerBar}
        <Animated.View
          testID="onboarding-hero"
          style={[styles.hero, styles.cover, { height: cover.cover }, coverStyle]}
        >
          <HalftoneGround
            id="onboarding-top"
            width={width}
            height={cover.cover}
            points={cover.points}
          />
          {art({ ...cover, top: cover.artTop })}
        </Animated.View>
        {/* A tap anywhere while the red covers the screen opens the step at once. */}
        {!opened && (
          <Pressable
            testID="onboarding-intro"
            accessible={false}
            onPress={() => {
              giveWay(open, setGivenWay);
            }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.cover}>{skipRow}</View>
      </Animated.View>
    );

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
        {art(hero)}
        {skipRow}
      </View>
      {framed ? (
        <View testID="onboarding-content" style={[styles.content, styles.framed]}>
          {body}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          testID="onboarding-content"
          onContentSizeChange={(_, contentHeight) => {
            setContent(contentHeight);
          }}
          style={styles.scroll}
          contentContainerStyle={styles.content}
        >
          {body}
        </ScrollView>
      )}
      {footerBar}
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
      accessibilityLabel={strings.onboarding.later}
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

/** The text every step's content shares: the heading block, its title and its text, in the type roles' sizes. */
export const stepStyles = StyleSheet.create({
  heading: { gap: onboardingLayout.gap },
});

const styles = StyleSheet.create({
  step: { flex: 1 },
  // The intro's content waits under the screen's bottom edge.
  clipped: { overflow: 'hidden' },
  hero: { overflow: 'hidden' },
  // The intro's red and «Пропустити» lie over the step.
  cover: { position: 'absolute', left: 0, right: 0, top: 0 },
  // The intro's heading and card, as the framed content lays them out.
  revealed: { flex: 1, gap: onboardingLayout.gap },
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
  // A framed step's content fills the room above the buttons, the card's frame its last block.
  framed: { flex: 1, paddingBottom: space[3] },
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
  later: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
