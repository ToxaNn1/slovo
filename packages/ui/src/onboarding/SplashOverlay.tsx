'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { LaunchKind } from '@slovo/core';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { Mascot } from '../primitives/Mascot';
import { Wedge } from '../primitives/Wedge';
import {
  capitalMarkStyle,
  halftone,
  motion,
  splashMotion,
  typeRoles,
  typeStyle,
  type Easing as Curve,
} from '../tokens';

export interface SplashOverlayProps {
  /** The app's name, whose letters fly in. */
  wordmark: string;
  /** The Edition's tagline on the ink band. */
  tagline: string;
  /** The first launch plays the whole cut; the daily open replays it fast. */
  kind: LaunchKind;
  /** Called once the splash is on screen, when the native splash can go. */
  onShown?: () => void;
  /** Called once the cut has played, when the app takes over. */
  onDone: () => void;
}

const { frame, letter, cut, roll } = splashMotion;

function curve([x1, y1, x2, y2]: Curve) {
  return Easing.bezier(x1, y1, x2, y2);
}

/**
 * The design's splash cut (ADR 0070): on the halftone red, the wordmark's
 * letters fly in, the ink band cuts across with the tagline and the Mascot
 * rolls in shouting; then the app takes over. The daily open replays it at
 * about half a second; under Reduce Motion it is one fade and a shorter hold.
 */
export function SplashOverlay({ wordmark, tagline, kind, onShown, onDone }: SplashOverlayProps) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const letterChars = Array.from(wordmark);
  // The design's splash is fixed in both Themes: the light Theme's ink for the
  // letters and the band, its cream background for the tagline on the band.
  const { ink: inkOnRed, background: creamOnInk } = useSchemeColors('light');
  const reduceMotion = useReduceMotionKnown();
  const { width } = useWindowDimensions();
  const scale = width / frame.width;
  const { pace, hold, reduceMotionHold } = splashMotion[kind];
  const shown = useRef(false);

  const fade = useSharedValue(1);
  const letters = useSharedValue(0);
  const band = useSharedValue(0);
  const rolled = useSharedValue(0);

  useEffect(() => {
    // The cut waits for the system to say whether it may move.
    if (reduceMotion === undefined) return;
    const done = setTimeout(onDone, reduceMotion ? reduceMotionHold : hold);
    if (reduceMotion) {
      fade.value = 0;
      fade.value = withTiming(1, {
        duration: motion.reduceMotion.duration,
        easing: curve(motion.reduceMotion.easing),
        reduceMotion: ReduceMotion.Never,
      });
      letters.value = 1;
      band.value = 1;
      rolled.value = 1;
    } else {
      const last = letter.delay + letter.stagger * (wordmark.length - 1) + letter.duration;
      letters.value = withTiming(1, { duration: last * pace, reduceMotion: ReduceMotion.Never });
      band.value = withDelay(
        cut.delay * pace,
        withTiming(1, {
          duration: cut.duration * pace,
          easing: curve(cut.easing),
          reduceMotion: ReduceMotion.Never,
        }),
      );
      rolled.value = withTiming(1, {
        duration: roll.duration * pace,
        easing: curve(roll.easing),
        reduceMotion: ReduceMotion.Never,
      });
    }
    return () => {
      clearTimeout(done);
    };
    // The cut plays once, as soon as the system has answered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const bandStyle = useAnimatedStyle(() => ({ width: band.value * width }));
  const rollStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - rolled.value) * roll.from * scale },
      { rotate: `${String((1 - rolled.value) * roll.turn)}deg` },
    ],
  }));

  return (
    <Animated.View
      testID="splash"
      accessibilityLabel={wordmark}
      onLayout={() => {
        if (shown.current) return;
        shown.current = true;
        onShown?.();
      }}
      style={[
        StyleSheet.absoluteFill,
        styles.ground,
        { backgroundColor: colors.accent },
        fadeStyle,
      ]}
    >
      <Halftone />
      {/* Code points, not graphemes: Hermes has no Intl.Segmenter. */}
      {letterChars.map((char, index) => (
        <Letter
          // The wordmark never changes while the splash is up.
          key={index}
          char={char}
          index={index}
          count={letterChars.length}
          progress={letters}
          scale={scale}
          color={inkOnRed}
        />
      ))}
      <Animated.View style={[styles.band, bandStyle]}>
        <View style={{ width }}>
          <Wedge points={splashMotion.band} color={inkOnRed} width={width} height="100%" />
          <View style={styles.taglineRow}>
            <Text
              {...voice}
              // One line at every text size, as on the board: shrink, never cut.
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                typeStyle('splashTagline', tokens),
                {
                  color: creamOnInk,
                  transform: [{ rotate: `${String(splashMotion.tagline.turn)}deg` }],
                },
              ]}
            >
              {tagline.toUpperCase()}
            </Text>
          </View>
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.mascot,
          { left: splashMotion.mascot.x * scale, top: splashMotion.mascot.y * scale },
          rollStyle,
        ]}
      >
        <Mascot state="shouts" onRed />
      </Animated.View>
    </Animated.View>
  );
}

/** One letter of the wordmark, flying in from the screen's middle on its own beat. */
function Letter({
  char,
  index,
  count,
  progress,
  scale,
  color,
}: {
  char: string;
  index: number;
  count: number;
  progress: SharedValue<number>;
  scale: number;
  color: string;
}) {
  const tokens = useTokens();
  const { size, letterSpacing } = typeRoles.splashLetter;
  const place = splashMotion.letters[index % splashMotion.letters.length] ?? {
    x: 0,
    y: 0,
    rotate: 0,
  };
  const total = letter.delay + letter.stagger * (count - 1) + letter.duration;
  const start = (letter.delay + letter.stagger * index) / total;
  const length = letter.duration / total;
  const [x1, y1, x2, y2] = letter.easing;
  const easing = Easing.bezierFn(x1, y1, x2, y2);
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - start) / length));
    const k = easing(t);
    return {
      opacity: t === 0 ? 0 : Math.min(1, k),
      transform: [
        { translateX: (1 - k) * (letter.from.x - place.x) * scale },
        { translateY: (1 - k) * (letter.from.y - place.y) * scale },
        { scale: letter.fromScale + (1 - letter.fromScale) * k },
        { rotate: `${String(place.rotate + (1 - k) * letter.fromTurn)}deg` },
      ],
    };
  });
  return (
    <Animated.Text
      accessible={false}
      style={[
        typeStyle('splashLetter', tokens),
        styles.letter,
        {
          left: place.x * scale,
          top: place.y * scale,
          color,
          fontSize: size * scale,
          lineHeight: size * scale,
          letterSpacing: letterSpacing * scale,
          ...capitalMarkStyle('splashLetter', scale),
        },
        style,
      ]}
    >
      {char}
    </Animated.Text>
  );
}

/** The design's halftone raster over the red. */
function Halftone() {
  return (
    <Svg style={StyleSheet.absoluteFill} accessible={false}>
      <Defs>
        <Pattern
          id="splash-halftone"
          width={halftone.cell}
          height={halftone.cell}
          patternUnits="userSpaceOnUse"
        >
          <Circle
            cx={halftone.cell / 2}
            cy={halftone.cell / 2}
            r={halftone.radius}
            fill={halftone.dot}
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#splash-halftone)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  ground: { overflow: 'hidden' },
  letter: { position: 'absolute' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  taglineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    alignItems: 'center',
  },
  mascot: { position: 'absolute' },
});
