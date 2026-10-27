'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { RoundAnswer } from '@slovo/core';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { minTouchTarget, onFill, space, typeSize } from '../tokens';
import { RIGHT_FILL, shake, WRONG_FILL } from './round-motion';

/** A vowel button's width, narrower than the touch target so a long Word fits the SE; its hit slop makes up the rest. */
const VOWEL_WIDTH = 36;
const VOWEL_SLOP = (minTouchTarget - VOWEL_WIDTH) / 2;
/** The gap between the Word's letters, which leaves the vowel buttons apart. */
const LETTER_GAP = 2;
/** The Word's letter size (the Round's prompt size). */
const LETTER_SIZE = { fontSize: typeSize.roundPrompt, lineHeight: typeSize.roundPrompt * 1.3 };
/** How far the largest text sizes of iOS may scale a letter, so the Word keeps its shape. */
const LETTER_MAX_FONT_SCALE = 1.3;
/** Whether a character is a letter, which counts for a vowel's place, unlike an apostrophe or a hyphen. */
const LETTER = /\p{L}/u;

/** The answer to a Round of the vowel form. */
type VowelAnswer = Extract<RoundAnswer, { form: 'vowel' }>;

/**
 * A Round of the vowel form: the Word drawn letter by letter, each vowel to
 * tap a button and the other letters plain, which VoiceOver skips. A tap
 * answers with where the vowel stands. Once the answer is judged, every
 * stressed vowel fills in the correct colour with the correct tag and a wrong
 * tap in the wrong colour with the chosen tag, and shakes, which Reduce Motion
 * leaves out; the screen plays the answer's haptic. VoiceOver reads a vowel
 * with its place among the letters («а, третя літера»), then its tag. Key it
 * by the Round, so a new Round starts unanswered.
 */
export function VowelButtons({
  text,
  vowels,
  answer,
  onAnswer,
  texts,
  testID,
}: {
  /** The Word as shown, without its Stress. */
  text: string;
  /** Where in the text each vowel to tap stands, in order. */
  vowels: readonly number[];
  /** The Round's answer, once given. */
  answer: VowelAnswer | undefined;
  /** Called with where in the text the vowel tapped stands. */
  onAnswer: (position: number) => void;
  /** The Edition's texts. */
  texts: {
    /** What VoiceOver reads for a vowel: the letter and its place among the letters from 0. */
    vowelLabel: (letter: string, place: number) => string;
    /** The tag of a stressed vowel once answered, «Правильно». */
    correct: string;
    /** The tag of a wrong tap, «Ваш вибір». */
    chosen: string;
  };
  testID: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const letterStyle = [LETTER_SIZE, styles.letter, { fontFamily: fontFamilies.word }];
  let place = 0;
  return (
    <View testID={testID} style={styles.word}>
      {Array.from(text, (letter, position) => {
        const letterPlace = place;
        if (LETTER.test(letter)) place += 1;
        if (!vowels.includes(position))
          return (
            <Text
              key={position}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              maxFontSizeMultiplier={LETTER_MAX_FONT_SCALE}
              style={[letterStyle, { color: colors.ink }]}
            >
              {letter}
            </Text>
          );
        const fill =
          answer === undefined
            ? undefined
            : answer.stressed.includes(position)
              ? 'right'
              : answer.chosen === position
                ? 'wrong'
                : undefined;
        return (
          <Vowel
            key={position}
            testID={`${testID}-${String(position)}`}
            letter={letter}
            label={[
              texts.vowelLabel(letter, letterPlace),
              fill === 'right' ? texts.correct : fill === 'wrong' ? texts.chosen : undefined,
            ]
              .filter(Boolean)
              .join(', ')}
            fill={fill}
            disabled={answer !== undefined}
            onPress={() => {
              onAnswer(position);
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * A vowel to tap. A judged answer fills it in the correct or the wrong
 * colour, and the wrong one shakes, but with Reduce Motion.
 */
function Vowel({
  testID,
  letter,
  label,
  fill,
  disabled,
  onPress,
}: {
  testID: string;
  letter: string;
  label: string;
  /** How the judged answer fills it; nothing before the answer or for a vowel neither stressed nor tapped. */
  fill: 'right' | 'wrong' | undefined;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the vowel has filled. */
  const filled = useSharedValue(fill === undefined ? 0 : 1);
  const shift = useSharedValue(0);
  // Whether the vowel showed its fill before, so only the answer given now moves it.
  const shownFill = useRef(fill !== undefined);

  useEffect(() => {
    if (fill === undefined || shownFill.current) return;
    shownFill.current = true;
    filled.value = withTiming(1, fill === 'right' ? RIGHT_FILL : WRONG_FILL);
    if (fill === 'wrong' && !reduceMotion) shift.value = shake();
    // The shared values are stable, and a change of Reduce Motion finds the
    // answer already shown, so only the answer given moves the vowel.
  }, [fill, reduceMotion, filled, shift]);

  const paint = fill === 'right' ? light.correct : light.wrong;
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
    ...(fill === undefined
      ? {}
      : {
          backgroundColor: interpolateColor(filled.value, [0, 1], [colors.surface, paint]),
          borderColor: interpolateColor(filled.value, [0, 1], [colors.line, paint]),
        }),
  }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ left: VOWEL_SLOP, right: VOWEL_SLOP }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.vowel,
            {
              backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
              borderColor: colors.line,
              borderRadius: radii.button,
            },
            motion,
          ]}
        >
          <Text
            maxFontSizeMultiplier={LETTER_MAX_FONT_SCALE}
            style={[
              LETTER_SIZE,
              styles.letter,
              { color: fill === undefined ? colors.ink : onFill, fontFamily: fontFamilies.word },
            ]}
          >
            {letter}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  word: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: LETTER_GAP,
    paddingVertical: space[2],
  },
  letter: { fontWeight: '500', textAlign: 'center' },
  vowel: {
    minHeight: minTouchTarget,
    minWidth: VOWEL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
