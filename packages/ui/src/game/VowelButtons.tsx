'use no memo';
// Reanimated or gesture code: the React Compiler skips this module.

import type { RoundAnswer } from '@slovo/core';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { PressedTile } from '../primitives/PressedTile';
import { useReduceMotion } from '../providers/useReduceMotion';
import {
  fontScaleCap,
  minTouchTarget,
  roleAt,
  roleSize,
  space,
  typeStyle,
  vowelButtonsLayout,
} from '../tokens';
import { useAnswerMotion, type AnswerDrop } from './useAnswerMotion';

/** How a wrong tap drops: down, tilted and faded, the board's `slDrop`. */
const VOWEL_DROP: AnswerDrop = { translateY: 12, rotate: -6, opacity: 0.55 };
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
 * Every letter takes a cell (board «slogo game last») of the
 * tile's width in capitals on one line, the other letters in grey with no
 * tile, the cells narrowing for a long Word; a red stress mark flies onto
 * each stressed vowel once answered; under Reduce Motion it stands there still.
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
  const [room, setRoom] = useState<number | undefined>(undefined);
  const cell = cellOf(room, Array.from(text).length);
  const letterStyle = [
    typeStyle('vowelCell', tokens),
    roleAt('vowelCell', cell.fontSize),
    styles.letter,
    { width: cell.width, color: colors.muted },
  ];
  let place = 0;
  return (
    <View
      testID={testID}
      onLayout={(event) => {
        setRoom(event.nativeEvent.layout.width);
      }}
      style={styles.word}
    >
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
              style={letterStyle}
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
            cell={cell}
            slop={slopOf(cell.width, vowels.includes(position - 1), vowels.includes(position + 1))}
            marked={fill === 'right'}
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
  cell,
  slop,
  marked,
  disabled,
  onPress,
}: {
  testID: string;
  letter: string;
  label: string;
  /** The letter's cell, its width and face size. */
  cell: Cell;
  /** How far its touch area reaches past the cell on each side. */
  slop: { readonly left: number; readonly right: number };
  /** How the judged answer fills it; nothing before the answer or for a vowel neither stressed nor tapped. */
  fill: 'right' | 'wrong' | undefined;
  /** Whether the red stress mark stands over it (board 06 «Наголос»). */
  marked: boolean;
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
        hitSlop={slop}
        faceStyle={[
          styles.vowel,
          { width: cell.width, minWidth: cell.width },
          fill === 'wrong' && { backgroundColor: colors.surfaceSunken },
        ]}
      >
        <Text
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[
            typeStyle('vowelCell', tokens),
            roleAt('vowelCell', cell.fontSize),
            styles.letter,
            {
              color: fill === 'right' ? keyInk : fill === 'wrong' ? colors.muted : colors.ink,
            },
          ]}
        >
          {letter}
        </Text>
      </PressedTile>
      {marked && <StressMark testID={`${testID}-mark`} width={cell.width} />}
    </Animated.View>
  );
}

const MARK = vowelButtonsLayout.mark;

/**
 * The red stress mark over a stressed vowel (board 06 «Наголос»): a slanted
 * bar that flies in from above and to the right as it lands, the board's
 * `slFly`, or stands still under Reduce Motion. VoiceOver skips it: the
 * vowel reads «Правильно».
 */
function StressMark({ testID, width }: { testID: string; width: number | undefined }) {
  const { colors } = useTokens();
  const reduceMotion = useReduceMotion();
  const landed = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) landed.value = withTiming(1, { duration: MARK.duration });
    // The shared value is stable; the mark flies once, as it appears.
  }, [landed, reduceMotion]);
  const flight = useAnimatedStyle(() => ({
    opacity: landed.value,
    transform: [
      { translateX: interpolate(landed.value, [0, 1], [MARK.flyX, 0]) },
      { translateY: interpolate(landed.value, [0, 1], [MARK.flyY, 0]) },
      { scale: interpolate(landed.value, [0, 1], [0.15, 1]) },
      { rotate: `${String(interpolate(landed.value, [0, 1], [-30, 0]))}deg` },
      { skewX: `${String(MARK.skew)}deg` },
    ],
  }));
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        width !== undefined && { left: (width - MARK.width) / 2 },
        { backgroundColor: colors.accent },
        flight,
      ]}
    />
  );
}

/** A letter's cell: its width and its face size. */
interface Cell {
  readonly width: number;
  readonly fontSize: number;
}

const CELL_FACE = roleSize('vowelCell').fontSize;

/**
 * The cell of each letter: the tile's width, narrower for a
 * Word too long for the room, its face shrinking with it, so the Word keeps
 * to one line (board «slogo game last»).
 */
function cellOf(room: number | undefined, letters: number): Cell {
  const full = vowelButtonsLayout.width;
  if (room === undefined || letters === 0) return { width: full, fontSize: CELL_FACE };
  const fits = (room - vowelButtonsLayout.cellGap * (letters - 1)) / letters;
  const width = Math.min(full, Math.floor(fits));
  return { width, fontSize: (CELL_FACE * width) / full };
}

/**
 * How far a vowel's touch area reaches past its cell on each side: out to a
 * full touch target from the cell's width, narrowed for a long Word, but only
 * half the gap towards a vowel beside it, so neighbours never take each
 * other's taps.
 */
function slopOf(width: number, vowelLeft: boolean, vowelRight: boolean) {
  const toTarget = Math.max(0, (minTouchTarget - width) / 2);
  const between = Math.min(toTarget, vowelButtonsLayout.cellGap / 2);
  return { left: vowelLeft ? between : toTarget, right: vowelRight ? between : toTarget };
}

/** The room over the vowels for the stress mark to land in. */
const MARK_ROOM = vowelButtonsLayout.mark.height + vowelButtonsLayout.mark.rise;

const styles = StyleSheet.create({
  // Every letter takes a cell on one line (board «slogo game last»), the mark landing over it.
  word: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: vowelButtonsLayout.cellGap,
    paddingTop: MARK_ROOM,
    paddingBottom: space[2],
  },
  letter: { textAlign: 'center' },
  mark: {
    position: 'absolute',
    bottom: '100%',
    left: (vowelButtonsLayout.width - MARK.width) / 2,
    width: MARK.width,
    height: MARK.height,
    marginBottom: MARK.rise,
  },
  vowel: {
    minHeight: vowelButtonsLayout.height,
    minWidth: vowelButtonsLayout.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
