'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { LaunchKind } from '@slovo/core';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { Mascot } from '../primitives/Mascot';
import {
  capitalMarkRoom,
  roleAt,
  splashMotion,
  typeRoles,
  typeStyle,
  type Easing as Curve,
  type SplashStop,
} from '../tokens';

export interface SplashOverlayProps {
  /** The app's name, whose letters pop up. */
  wordmark: string;
  /** The Edition's tagline under the wordmark. */
  tagline: string;
  /** The first launch plays the whole cut; the daily open plays it fast. */
  kind: LaunchKind;
  /** Called once the splash is on screen, when the native splash can go. */
  onShown?: () => void;
  /** Called once the cut has played, when the app takes over. */
  onDone: () => void;
}

const {
  frame,
  logo,
  wedge,
  s,
  letters,
  tagline: taglineMotion,
  mascot,
  shout,
  wipe,
} = splashMotion;

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Ease = (x: number) => number;

function curve([x1, y1, x2, y2]: Curve): Ease {
  return Easing.bezierFn(x1, y1, x2, y2);
}

/** A track's value at `t` of the cut, eased segment by segment between its keyframes. */
function track(t: number, stops: readonly SplashStop[], ease: Ease): number {
  'worklet';
  let [at, value] = stops[0] ?? [0, 0];
  if (t <= at) return value;
  for (const [nextAt, nextValue] of stops) {
    if (t <= nextAt) return value + (nextValue - value) * ease((t - at) / (nextAt - at));
    at = nextAt;
    value = nextValue;
  }
  return value;
}

/** How the cut's 390 × 844 frame lands on the screen: scaled to fit, around the middle. */
interface Fit {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
  /** The screen's y of the frame's `y`. */
  readonly y: (y: number) => number;
  /** The screen's x of the frame's `x`. */
  readonly x: (x: number) => number;
}

/**
 * The design's splash cut (ADR 0070): on the Theme's background the red wedge
 * unfolds, the S is drawn, the wordmark's letters pop up, the tagline rises,
 * the Mascot jumps in shouting, and a red wedge wipes the screen to the app.
 * It plays once: the whole cut on the first launch, fast on a daily open.
 * Under Reduce Motion nothing moves: the cut's still frame holds a moment.
 */
export function SplashOverlay({ wordmark, tagline, kind, onShown, onDone }: SplashOverlayProps) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  // Code points, not graphemes: Hermes has no Intl.Segmenter.
  const letterChars = Array.from(wordmark);
  const reduceMotion = useReduceMotionKnown();
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / frame.width, height / frame.height);
  const fit: Fit = {
    scale,
    width,
    height,
    x: (x) => width / 2 + (x - frame.width / 2) * scale,
    y: (y) => height / 2 + (y - frame.height / 2) * scale,
  };
  const { duration, reduceMotionHold } = splashMotion[kind];
  const shown = useRef(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    // The cut waits for the system to say whether it may move.
    if (reduceMotion === undefined) return;
    if (reduceMotion) {
      progress.value = splashMotion.still;
    } else {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      });
    }
    const done = setTimeout(onDone, reduceMotion ? reduceMotionHold : duration);
    return () => {
      clearTimeout(done);
    };
    // The cut plays once, as soon as the system has answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const taglineEase = curve(taglineMotion.easing);
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: track(progress.value, taglineMotion.opacity, taglineEase),
    transform: [{ translateY: track(progress.value, taglineMotion.rise, taglineEase) * scale }],
  }));
  const taglineSize = typeRoles.splashTagline.size * scale;

  return (
    <View
      testID="splash"
      accessibilityLabel={wordmark}
      onLayout={() => {
        if (shown.current) return;
        shown.current = true;
        onShown?.();
      }}
      style={[StyleSheet.absoluteFill, styles.ground, { backgroundColor: colors.background }]}
    >
      <Logo progress={progress} fit={fit} />
      <LetterRow chars={letterChars} progress={progress} fit={fit} />
      <Animated.View style={[styles.row, { top: fit.y(taglineMotion.top) }, taglineStyle]}>
        <Text
          {...voice}
          // One line at every text size: shrink, never cut.
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            typeStyle('splashTagline', tokens),
            roleAt('splashTagline', taglineSize),
            { color: colors.muted },
          ]}
        >
          {tagline}
        </Text>
      </Animated.View>
      <MascotJump progress={progress} fit={fit} />
      {reduceMotion === false && <Wipe progress={progress} fit={fit} />}
    </View>
  );
}

/** The mark: the red wedge unfolding from its left edge, and the S drawn over it. */
function Logo({ progress, fit }: { progress: SharedValue<number>; fit: Fit }) {
  const { colors } = useTokens();
  const size = logo.size * fit.scale;
  // The wedge turns about its left edge, not its middle.
  const shift = ((wedge.originX - 50) / 100) * size;
  const logoEase = curve(logo.easing);
  const wedgeEase = curve(wedge.easing);
  const sEase = curve(s.easing);
  const logoStyle = useAnimatedStyle(() => ({
    opacity: track(progress.value, logo.opacity, logoEase),
    transform: [
      { scale: track(progress.value, logo.scale, logoEase) },
      { rotate: `${String(track(progress.value, logo.turn, logoEase))}deg` },
    ],
  }));
  const wedgeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shift },
      { scaleX: track(progress.value, wedge.scaleX, wedgeEase) },
      { translateX: -shift },
    ],
  }));
  const sProps = useAnimatedProps(() => ({
    strokeDashoffset: track(progress.value, s.offset, sEase),
  }));
  return (
    <Animated.View
      style={[
        styles.logo,
        {
          left: fit.x(frame.width / 2) - size / 2,
          top: fit.y(logo.top),
          width: size,
          height: size,
        },
        logoStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, wedgeStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
          <Polygon points={wedge.points} fill={colors.accent} />
        </Svg>
      </Animated.View>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        accessible={false}
        style={StyleSheet.absoluteFill}
      >
        <AnimatedPath
          d={s.path}
          fill="none"
          stroke={colors.onAccent}
          strokeWidth={s.stroke}
          strokeDasharray={s.dash}
          animatedProps={sProps}
        />
      </Svg>
    </Animated.View>
  );
}

/** The wordmark's row, which clips each letter until it pops up into place. */
function LetterRow({
  chars,
  progress,
  fit,
}: {
  chars: readonly string[];
  progress: SharedValue<number>;
  fit: Fit;
}) {
  const drawn = roleAt('splashLetter', typeRoles.splashLetter.size * fit.scale);
  // The row's clip leaves room for a capital's marks, such as Й's breve.
  const room = capitalMarkRoom('splashLetter', drawn);
  const pad = letters.pad * fit.scale;
  return (
    <View
      style={[
        styles.row,
        styles.letters,
        { top: fit.y(letters.top) - room, paddingTop: pad + room, paddingBottom: pad },
      ]}
    >
      {chars.map((char, index) => (
        <Letter
          // The wordmark never changes while the splash is up.
          key={index}
          char={char}
          index={index}
          progress={progress}
          fit={fit}
          rise={drawn.lineHeight + room}
        />
      ))}
    </View>
  );
}

/** One letter of the wordmark, popping up from under its row on its own beat. */
function Letter({
  char,
  index,
  progress,
  fit,
  rise,
}: {
  char: string;
  index: number;
  progress: SharedValue<number>;
  fit: Fit;
  rise: number;
}) {
  const tokens = useTokens();
  const { size, letterSpacing } = typeRoles.splashLetter;
  const ease = curve(letters.easing);
  const delay = index * letters.stagger;
  const style = useAnimatedStyle(() => {
    const t = progress.value - delay;
    return {
      opacity: track(t, letters.opacity, ease),
      transform: [{ translateY: track(t, letters.rise, ease) * rise }],
    };
  });
  return (
    <Animated.Text
      accessible={false}
      style={[
        typeStyle('splashLetter', tokens),
        {
          color: tokens.colors.ink,
          ...roleAt('splashLetter', size * fit.scale),
          letterSpacing: letterSpacing * fit.scale,
        },
        style,
      ]}
    >
      {char}
    </Animated.Text>
  );
}

/** The Mascot jumping in from under the screen, landing with a squash, and its shout lines. */
function MascotJump({ progress, fit }: { progress: SharedValue<number>; fit: Fit }) {
  const { colors } = useTokens();
  const ease = curve(mascot.easing);
  const shoutEase = curve(shout.easing);
  const { scale } = fit;
  const jumpStyle = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: track(t, mascot.opacity, ease),
      transform: [
        { translateY: track(t, mascot.rise, ease) * scale },
        { rotate: `${String(track(t, mascot.turn, ease))}deg` },
        { scaleX: track(t, mascot.scaleX, ease) },
        { scaleY: track(t, mascot.scaleY, ease) },
      ],
    };
  });
  const shoutStyle = useAnimatedStyle(() => ({
    opacity: track(progress.value, shout.opacity, shoutEase),
    transform: [{ scale: track(progress.value, shout.scale, shoutEase) }],
  }));
  return (
    <Animated.View
      style={[
        styles.mascot,
        {
          left: fit.x(mascot.left),
          bottom: fit.height - fit.y(frame.height - mascot.bottom),
          width: mascot.box * fit.scale,
        },
        jumpStyle,
      ]}
    >
      <Mascot state="shouts" width={mascot.width * fit.scale} />
      <Animated.View
        style={[
          styles.shout,
          { right: shout.right * fit.scale, top: shout.top * fit.scale },
          shoutStyle,
        ]}
      >
        <Svg
          width={shout.width * fit.scale}
          height={shout.height * fit.scale}
          viewBox={`0 0 ${String(shout.width)} ${String(shout.height)}`}
          accessible={false}
        >
          {shout.red.map((points) => (
            <Polygon key={points} points={points} fill={colors.accent} />
          ))}
          <Polygon points={shout.ink} fill={colors.ink} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** The red wedge that wipes the screen at the end of the cut. */
function Wipe({ progress, fit }: { progress: SharedValue<number>; fit: Fit }) {
  const { colors } = useTokens();
  const ease = curve(wipe.easing);
  const wipeWidth = wipe.width * fit.width;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: track(progress.value, wipe.x, ease) * wipeWidth },
      { skewX: `${String(wipe.skew)}deg` },
    ],
  }));
  return (
    <Animated.View
      testID="splash-wipe"
      style={[
        styles.wipe,
        {
          top: -wipe.bleed * fit.scale,
          bottom: -wipe.bleed * fit.scale,
          left: wipe.left * fit.width,
          width: wipeWidth,
          backgroundColor: colors.accent,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ground: { overflow: 'hidden' },
  logo: { position: 'absolute' },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  letters: { overflow: 'hidden' },
  mascot: { position: 'absolute', alignItems: 'center', transformOrigin: 'bottom' },
  shout: { position: 'absolute', transformOrigin: 'left' },
  wipe: { position: 'absolute' },
});
