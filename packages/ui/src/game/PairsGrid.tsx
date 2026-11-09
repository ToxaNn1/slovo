'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import { stressLabel, type GridCell, type RoundAnswer, type RoundOption } from '@slovo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressedTile, type TileTone } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { pairsGridLayout, space, typeStyle } from '../tokens';
import { RIGHT_FILL, WRONG_FILL } from './round-motion';

/** How far the largest text sizes of iOS may scale a Definition, so a long one stays in the grid. */
const DEFINITION_MAX_FONT_SCALE = 1.5;
/** How a right pair pops: from small, past its size, back. */
const CELL_POP = [0.6, 1.12, 1];
/** How far a wrong pair drops, how far its cells turn (a Word left, a Definition right), how much it fades. */
const CELL_DROP = 8;
const CELL_TURN = 3;
const WRONG_OPACITY = 0.6;

/** The face of a cell in each look. */
const TONES: Record<Look, TileTone> = {
  rest: 'tile',
  selected: 'ink',
  right: 'accent',
  wrong: 'none',
};

/** The answer to a Round of the pairs form. */
type PairsAnswer = Extract<RoundAnswer, { form: 'pairs' }>;

/** What a cell shows: at rest, the selected Word, or a judged pair's right or wrong look. */
type Look = 'rest' | 'selected' | 'right' | 'wrong';

/**
 * A pairs grid: its Words in a column on the left and its Definitions on the
 * right, each a tile of the design. A tap on a Word selects it, a tap on it
 * again or on another Word changes the selection, and a tap on a Definition
 * then gives the pair, which leaves nothing selected; a Definition tapped
 * before a Word does nothing. The selected Word turns ink. Once the pair is
 * judged, a right pair turns red and pops; a wrong one sinks, mutes, drops
 * and turns aside, a Word left and a Definition right. Under Reduce Motion
 * nothing pops, drops or turns. Nothing shakes; the screen plays the
 * answer's haptic. A pair gone, answered right, leaves its places empty,
 * which VoiceOver skips. VoiceOver reads each Word with its Stress and each
 * Definition by its text. Key it by the Round, so a new Round starts with
 * nothing selected.
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
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { strings } = useEdition();
  const [selected, setSelected] = useState<number>();
  const lookOf = (place: number, answered: number | undefined, on: boolean): Look => {
    if (answer === undefined || place !== answered) return on ? 'selected' : 'rest';
    return answer.right ? 'right' : 'wrong';
  };
  const textColor = (look: Look): string =>
    ({ rest: colors.ink, selected: colors.background, right: keyInk, wrong: colors.muted })[look];

  return (
    <View testID="pairs" style={styles.grid}>
      <View style={styles.words}>
        {words.map(({ shown, gone }, place) => {
          const on = selected === place;
          const look = lookOf(place, answer?.word, on);
          return (
            <Cell
              key={place}
              testID={`pairs-word-${String(place)}`}
              label={stressLabel(strings.wordCard, shown.text, shown.stressedVowels)}
              look={look}
              turn={-CELL_TURN}
              gone={gone}
              answered={answer !== undefined}
              onPress={() => {
                setSelected(on ? undefined : place);
              }}
            >
              <WholeWordsText
                text={shown.text}
                typeRole="pairsWord"
                tracking={0}
                style={[typeStyle('pairsWord', tokens), styles.word, { color: textColor(look) }]}
              />
            </Cell>
          );
        })}
      </View>
      <View style={styles.definitions}>
        {definitions.map(({ shown, gone }, place) => {
          const look = lookOf(place, answer?.definition, false);
          return (
            <Cell
              key={place}
              testID={`pairs-definition-${String(place)}`}
              label={shown}
              look={look}
              turn={CELL_TURN}
              gone={gone}
              answered={answer !== undefined}
              onPress={() => {
                if (selected === undefined) return;
                setSelected(undefined);
                onAnswer(selected, place);
              }}
            >
              <Text
                maxFontSizeMultiplier={DEFINITION_MAX_FONT_SCALE}
                style={[typeStyle('pairsDefinition', tokens), { color: textColor(look) }]}
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

/**
 * A Word or a Definition of the grid on a pressed tile. Its face carries
 * `${testID}-face` and what pops, drops or turns it `${testID}-motion`.
 */
function Cell({
  testID,
  label,
  look,
  turn,
  gone,
  answered,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  look: Look;
  /** How far a wrong cell turns, in degrees. */
  turn: number;
  /** Whether its pair is answered and gone, leaving its place empty. */
  gone: boolean;
  /** Whether the Round is answered, so no cell takes a tap. */
  answered: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const judged = look === 'right' || look === 'wrong';
  /** 0 before the answer, 1 once the cell has popped or dropped. */
  const moved = useSharedValue(judged ? 1 : 0);
  // Whether the cell showed its answer before, so only the answer given now moves it.
  const shownJudged = useRef(judged);

  useEffect(() => {
    if (!judged || shownJudged.current) return;
    shownJudged.current = true;
    moved.value = withTiming(1, look === 'right' ? RIGHT_FILL : WRONG_FILL);
    // The shared value is stable, so only the answer given moves the cell.
  }, [judged, look, moved]);

  const still = reduceMotion || !judged;
  const motion = useAnimatedStyle(() => {
    if (look === 'wrong')
      return {
        opacity: 1 - (1 - WRONG_OPACITY) * moved.value,
        transform: still
          ? []
          : [
              { translateY: CELL_DROP * moved.value },
              { rotate: `${String(turn * moved.value)}deg` },
            ],
      };
    return {
      opacity: 1,
      transform: still ? [] : [{ scale: interpolate(moved.value, [0, 0.6, 1], CELL_POP) }],
    };
  });
  return (
    <View
      accessibilityElementsHidden={gone}
      importantForAccessibility={gone ? 'no-hide-descendants' : 'auto'}
      style={gone && styles.gone}
    >
      <Animated.View testID={`${testID}-motion`} style={motion} {...voice}>
        <PressedTile
          testID={testID}
          tone={TONES[look]}
          radius={pairsGridLayout.cellRadius}
          accessibilityLabel={label}
          accessibilityState={{ selected: look === 'selected', disabled: answered || gone }}
          inert={answered || gone}
          onPress={onPress}
          faceStyle={[styles.cell, look === 'wrong' && { backgroundColor: colors.surfaceSunken }]}
        >
          {children}
        </PressedTile>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: pairsGridLayout.cellGap },
  // The design's columns, .8 and 1.2 of the width.
  words: { flex: 2, gap: pairsGridLayout.cellGap },
  definitions: { flex: 3, gap: pairsGridLayout.cellGap },
  cell: {
    minHeight: pairsGridLayout.cellHeight,
    justifyContent: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  gone: { opacity: 0 },
  word: { textAlign: 'center' },
});
