'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { entryReveal, type RevealPace } from '../tokens';

const letterEasing = Easing.bezier(...entryReveal.letterEasing);

/** Letters of a text that fly into place: whether they are flying, or wait unseen, and at which pace once they fly. */
export interface FlyingLettersOf {
  readonly playing: boolean;
  readonly pace: () => RevealPace;
}

/** Each letter with the combining marks after it, such as a Stress mark. */
function letters(text: string): string[] {
  return text.match(/\P{M}\p{M}*/gu) ?? [];
}

/**
 * The letters of a text, each laid out alone as the text under them and
 * flying in from below, small and turned, one after another. The text under
 * them is drawn clear meanwhile, so each letter lands on its place. A mark
 * that falls on its own (`clearMark`) stays clear here. It is drawn for the
 * eye alone: VoiceOver reads the text under it.
 */
export function FlyingLetters({
  text,
  flying,
  clearMark,
  textProps,
  style,
  testID,
}: {
  text: string;
  flying: FlyingLettersOf;
  clearMark: string | undefined;
  /** How the text under the letters lays out, so the letters lay out alike. */
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
  const all = letters(text);
  const count = all.filter((letter) => letter.trim() !== '').length;
  const { color } = StyleSheet.flatten(style);
  return (
    <>
      {all.map((letter, index) => {
        if (letter.trim() === '') return null;
        // The letters fly in turn; a space takes no turn.
        const order = all.slice(0, index).filter((before) => before.trim() !== '').length;
        const shown =
          clearMark === undefined
            ? letter
            : letter.split(clearMark).flatMap((part, at) =>
                at === 0
                  ? [part]
                  : [
                      <Text key={at} style={styles.clear}>
                        {clearMark}
                      </Text>,
                      part,
                    ],
              );
        return (
          <FlyingLetter
            key={index}
            order={order}
            count={count}
            playing={flying.playing}
            pace={flying.pace}
            testID={testID === undefined ? undefined : `${testID}-${String(order)}`}
          >
            <Text {...textProps} style={[style, styles.clear]}>
              {all.slice(0, index).join('')}
              <Text style={{ color }}>{shown}</Text>
              {all.slice(index + 1).join('')}
            </Text>
          </FlyingLetter>
        );
      })}
    </>
  );
}

function FlyingLetter({
  order,
  count,
  playing,
  pace,
  testID,
  children,
}: {
  order: number;
  /** How many letters fly, the spaces left out. */
  count: number;
  playing: boolean;
  pace: () => RevealPace;
  testID: string | undefined;
  children: ReactNode;
}) {
  const { from } = entryReveal;
  const landed = useSharedValue(0);
  useEffect(() => {
    // Each play flies in from the start; a letter that stops playing waits there again, unseen.
    if (!playing) {
      landed.value = 0;
      return;
    }
    const flight = entryReveal[pace()].letters;
    // A long headline takes shorter turns, so its last letter starts within the spread.
    const stagger = Math.min(flight.stagger, flight.spread / Math.max(1, count - 1));
    landed.value = withDelay(
      flight.delay + order * stagger,
      withTiming(1, {
        duration: flight.duration,
        easing: letterEasing,
        reduceMotion: ReduceMotion.Never,
      }),
    );
  }, [playing, pace, order, count, landed]);
  const startX = from.x - order * from.xStep;
  const fly = useAnimatedStyle(() => {
    const away = 1 - landed.value;
    return {
      opacity: Math.min(1, Math.max(0, landed.value)),
      transform: [
        { translateX: away * startX },
        { translateY: away * from.y },
        { scale: from.scale + (1 - from.scale) * landed.value },
        { rotate: `${String(away * from.rotate)}deg` },
      ],
    };
  });
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.over, fly]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  over: { position: 'absolute', top: 0, left: 0, right: 0 },
  clear: { color: 'transparent' },
});
