import type { GridCell, RoundAnswer, RoundOption } from '@slovo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { stressLabel } from '../entries/stress-label';
import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { onFill, roundLayout, space, typeSize } from '../tokens';
import { RIGHT_FILL, shake, WRONG_FILL } from './round-motion';

/** A cell's least height, an answer option's, above the 44 pt touch target. */
const CELL_HEIGHT = 58;
/** A Word's text, smaller than an option's so it fits half the width. */
const WORD_SIZE = { fontSize: typeSize.listItem, lineHeight: typeSize.listItem * 1.3 };
/** A Definition's text, which wraps over as many lines as it needs. */
const DEFINITION_SIZE = typeSize.body;
const DEFINITION_LINE_HEIGHT = typeSize.body * 1.35;
/** How far the largest text sizes of iOS may scale a Definition, so a long one stays in the grid. */
const DEFINITION_MAX_FONT_SCALE = 1.5;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The answer to a Round of the pairs form. */
type PairsAnswer = Extract<RoundAnswer, { form: 'pairs' }>;

/** How a judged answer fills a cell; nothing before the answer or for a cell not in the pair. */
type Fill = 'right' | 'wrong' | undefined;

/**
 * A pairs grid: its Words in a column on the left and its Definitions on the
 * right, each wrapping as long as it runs. A tap on a Word selects it, a tap
 * on it again or on another Word changes the selection, and a tap on a
 * Definition then gives the pair, which leaves nothing selected; a Definition
 * tapped before a Word does nothing. Once the pair is judged, its Word and
 * Definition fill in the correct or the wrong colour and a wrong pair shakes,
 * which Reduce Motion leaves out; the screen plays the answer's haptic. A pair
 * gone, answered right, leaves its places empty, which VoiceOver skips.
 * VoiceOver reads each Word with its Stress and each Definition by its text.
 * Key it by the Round, so a new Round starts with nothing selected.
 */
export function PairsGrid({
  words,
  definitions,
  answer,
  onAnswer,
}: {
  /** The grid's Words, in the order shown. */
  words: readonly GridCell<RoundOption>[];
  /** The grid's Definitions, in the order shown. */
  definitions: readonly GridCell<string>[];
  /** The Round's answer, once given. */
  answer: PairsAnswer | undefined;
  /** The place of the Word tapped among the Words, then of the Definition among the Definitions. */
  onAnswer: (word: number, definition: number) => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings } = useEdition();
  const [selected, setSelected] = useState<number>();
  const fillOf = (place: number, answered: number | undefined): Fill =>
    answer === undefined || place !== answered ? undefined : answer.right ? 'right' : 'wrong';

  return (
    <View testID="pairs" style={styles.grid}>
      <View style={styles.words}>
        {words.map(({ shown, gone }, place) => {
          const fill = fillOf(place, answer?.word);
          const on = selected === place;
          return (
            <Cell
              key={place}
              testID={`pairs-word-${String(place)}`}
              label={stressLabel(strings.wordCard, shown.text, shown.stressedVowels)}
              selected={on}
              gone={gone}
              fill={fill}
              disabled={answer !== undefined}
              onPress={() => {
                setSelected(on ? undefined : place);
              }}
            >
              <WholeWordsText
                text={shown.text}
                size={WORD_SIZE}
                tracking={0}
                style={[
                  styles.word,
                  { color: textColor(fill, on, colors), fontFamily: fontFamilies.word },
                ]}
              />
            </Cell>
          );
        })}
      </View>
      <View style={styles.definitions}>
        {definitions.map(({ shown, gone }, place) => {
          const fill = fillOf(place, answer?.definition);
          return (
            <Cell
              key={place}
              testID={`pairs-definition-${String(place)}`}
              label={shown}
              selected={false}
              gone={gone}
              fill={fill}
              disabled={answer !== undefined}
              onPress={() => {
                if (selected === undefined) return;
                setSelected(undefined);
                onAnswer(selected, place);
              }}
            >
              <Text
                maxFontSizeMultiplier={DEFINITION_MAX_FONT_SCALE}
                style={[
                  styles.definition,
                  { color: textColor(fill, false, colors), fontFamily: fontFamilies.ui },
                ]}
              >
                {shown}
              </Text>
            </Cell>
          );
        })}
      </View>
    </View>
  );
}

/** A cell's text colour: white on a fill, the background's on the selected Word, ink otherwise. */
function textColor(
  fill: Fill,
  selected: boolean,
  colors: ReturnType<typeof useTokens>['colors'],
): string {
  if (fill !== undefined) return onFill;
  return selected ? colors.background : colors.ink;
}

/**
 * A Word or a Definition of the grid. The selected Word fills in ink; a judged
 * pair's cells fill in the correct or the wrong colour, the light scheme's in
 * both Themes, and the wrong ones shake, but with Reduce Motion.
 */
function Cell({
  testID,
  label,
  selected,
  gone,
  fill,
  disabled,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  selected: boolean;
  /** Whether its pair is answered and gone, leaving its place empty. */
  gone: boolean;
  fill: Fill;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { colors, radii } = useTokens();
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the cell has filled. */
  const filled = useSharedValue(fill === undefined ? 0 : 1);
  const shift = useSharedValue(0);
  // Whether the cell showed its fill before, so only the answer given now moves it.
  const shownFill = useRef(fill !== undefined);

  useEffect(() => {
    if (fill === undefined || shownFill.current) return;
    shownFill.current = true;
    filled.value = withTiming(1, fill === 'right' ? RIGHT_FILL : WRONG_FILL);
    if (fill === 'wrong' && !reduceMotion) shift.value = shake();
    // The shared values are stable, and a change of Reduce Motion finds the
    // answer already shown, so only the answer given moves the cell.
  }, [fill, reduceMotion, filled, shift]);

  const rest = selected ? colors.ink : colors.surface;
  const restBorder = selected ? colors.ink : colors.line;
  const paint = fill === 'right' ? light.correct : light.wrong;
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }],
    ...(fill === undefined
      ? {}
      : {
          backgroundColor: interpolateColor(filled.value, [0, 1], [rest, paint]),
          borderColor: interpolateColor(filled.value, [0, 1], [restBorder, paint]),
        }),
  }));
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: disabled || gone }}
      accessibilityElementsHidden={gone}
      importantForAccessibility={gone ? 'no-hide-descendants' : 'auto'}
      {...voice}
      disabled={disabled || gone}
      onPress={onPress}
      style={[
        styles.cell,
        { backgroundColor: rest, borderColor: restBorder, borderRadius: radii.button },
        motion,
        gone && styles.gone,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: roundLayout.gap },
  words: { flex: 2, gap: roundLayout.gap },
  definitions: { flex: 3, gap: roundLayout.gap },
  cell: {
    flexGrow: 1,
    minHeight: CELL_HEIGHT,
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  gone: { opacity: 0 },
  word: { fontWeight: '500', textAlign: 'center' },
  definition: { fontSize: DEFINITION_SIZE, lineHeight: DEFINITION_LINE_HEIGHT },
});
