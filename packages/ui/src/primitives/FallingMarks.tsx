'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Marks in a text that fall into place, such as the Stress mark of a Lemma. */
export interface FallingMarksOf {
  /** The mark that falls, wherever it is in the text. */
  readonly mark: string;
  /** Whether the fall plays; until then, and once it stops, the marks wait above the text, unseen. */
  readonly playing: boolean;
}

/** The fall lasts 300 ms (ADR 0055). */
const FALL = {
  duration: 300,
  easing: Easing.out(Easing.cubic),
  // The caller leaves the fall out with Reduce Motion.
  reduceMotion: ReduceMotion.Never,
};

/** How far above its place a mark starts, as a share of the font size. */
const FALL_HEIGHT = 0.4;

/** The text with every `mark` in `markStyle`. */
export function withMarks(text: string, mark: string, markStyle: StyleProp<TextStyle>): ReactNode {
  return text.split(mark).flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <Text key={index} style={markStyle}>
            {mark}
          </Text>,
          part,
        ],
  );
}

/**
 * The marks of a text alone, laid out as the text under them, falling from
 * above into place while they fade in. The text under them draws its own
 * marks clear, so each mark lands on its character. It is drawn for the eye
 * alone: VoiceOver reads the text under it.
 */
export function FallingMarks({
  text,
  falling: { mark, playing },
  fontSize,
  textProps,
  style,
  testID,
}: {
  text: string;
  falling: FallingMarksOf;
  fontSize: number;
  /** How the text under the marks lays out, so the marks lay out alike. */
  textProps: Pick<
    TextProps,
    | 'numberOfLines'
    | 'adjustsFontSizeToFit'
    | 'minimumFontScale'
    | 'allowFontScaling'
    | 'maxFontSizeMultiplier'
  >;
  style: StyleProp<TextStyle>;
  testID: string | undefined;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    // Each play falls from above; a mark that stops playing waits above again.
    progress.value = playing ? withTiming(1, FALL) : 0;
  }, [playing, progress]);
  const height = fontSize * FALL_HEIGHT;
  const fall = useAnimatedStyle(
    () => ({
      opacity: progress.value,
      transform: [{ translateY: (progress.value - 1) * height }],
    }),
    [height],
  );
  const { color } = StyleSheet.flatten(style);

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.over, fall]}
    >
      <Text {...textProps} style={[style, styles.clear]}>
        {withMarks(text, mark, { color })}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  over: { position: 'absolute', top: 0, left: 0, right: 0 },
  clear: { color: 'transparent' },
});

/** The style of the marks the text under the falling ones leaves clear. */
export const clearMarks = styles.clear;
