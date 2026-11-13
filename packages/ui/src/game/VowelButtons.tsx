'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { RoundAnswer } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { PressedTile } from '../primitives/PressedTile';
import { fontScaleCap, minTouchTarget, space, typeStyle, vowelButtonsLayout } from '../tokens';
import { useAnswerMotion, type AnswerDrop } from './useAnswerMotion';

/** How a wrong tap drops: down, tilted and faded, the board's `slDrop`. */
const VOWEL_DROP: AnswerDrop = { translateY: 12, rotate: -6, opacity: 0.55 };
const VOWEL_SLOP = (minTouchTarget - vowelButtonsLayout.width) / 2;
/** Whether a character is a letter, which counts for a vowel's place, unlike an apostrophe or a hyphen. */
const LETTER = /\p{L}/u;

/** The answer to a Round of the vowel form. */
type VowelAnswer = Extract<RoundAnswer, { form: 'vowel' }>;

/**
 * A Round of the vowel form: the Word drawn letter by letter, each vowel to
 * tap a button and the other letters plain, which VoiceOver skips. A tap
 * answers with where the vowel stands. Once the answer is judged, every
 * stressed vowel turns red and pops with the correct tag and a wrong tap
 * drops with the chosen tag, nothing shaking; the screen
 * plays the answer's haptic. VoiceOver reads a vowel
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
    /** The tag of a wrong tap, «Твій вибір». */
    chosen: string;
  };
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const letterStyle = [typeStyle('vowelWordLetter', tokens), styles.letter];
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
              maxFontSizeMultiplier={fontScaleCap.number}
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
 * A vowel to tap, the design's letter tile. A judged answer turns a stressed
 * vowel red on its red edge and pops it, and drops a wrong tap: sunken,
 * muted, tilted and faded. Under Reduce Motion nothing pops or tilts; the
 * fill and the fade alone show the answer. Nothing shakes.
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
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const motion = useAnswerMotion(fill, VOWEL_DROP);
  return (
    <Animated.View testID={`${testID}-motion`} style={motion} {...voice}>
      <PressedTile
        testID={testID}
        tone={fill === 'right' ? 'accent' : fill === 'wrong' ? 'none' : 'tile'}
        radius={radii.tile}
        accessibilityLabel={label}
        inert={disabled}
        onPress={onPress}
        hitSlop={{ left: VOWEL_SLOP, right: VOWEL_SLOP }}
        faceStyle={[styles.vowel, fill === 'wrong' && { backgroundColor: colors.surfaceSunken }]}
      >
        <Text
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[
            typeStyle('vowelButton', tokens),
            styles.letter,
            {
              color: fill === 'right' ? keyInk : fill === 'wrong' ? colors.muted : colors.ink,
            },
          ]}
        >
          {letter}
        </Text>
      </PressedTile>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  word: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: vowelButtonsLayout.letterGap,
    paddingVertical: space[2],
  },
  letter: { textAlign: 'center' },
  vowel: {
    minHeight: vowelButtonsLayout.height,
    minWidth: vowelButtonsLayout.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
