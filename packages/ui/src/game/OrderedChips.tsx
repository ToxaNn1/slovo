'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { FixedChip, RoundAnswer } from '@slovo/core';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { PressedTile } from '../primitives/PressedTile';
import { space, typeStyle } from '../tokens';
import { RIGHT_FILL, WRONG_FILL } from './round-motion';

/** A place of the answer line, the design's slot: its height, least width, corner and border. */
const SLOT_HEIGHT = 64;
const SLOT_BORDER = 3;
/** A chip among the shuffled ones, the design's letter tile. */
const CHIP_HEIGHT = 60;
const CHIP_WIDTH = 54;
const CHIP_RADIUS = 14;
/** The gap between the chips, and between the answer line and the chips. */
const CHIP_GAP = 8;
const LINE_GAP = 22;
/** How faint a chip placed in the line stays among the shuffled ones. */
const PLACED_OPACITY = 0.25;
/** How far the largest text sizes of iOS may scale a chip's text, so a chip never breaks a word. */
const CHIP_MAX_FONT_SCALE = 1.5;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The answer to a Round of the chips form. */
type ChipsAnswer = Extract<RoundAnswer, { form: 'chips' }>;

/** How a judged answer shows in the line; nothing before the answer. */
type Judged = 'right' | 'wrong' | undefined;

/**
 * The chips of a Round of the chips form, letters of a Word or words of an
 * expression, shuffled on tiles, and the answer line over them, a dashed
 * place for each chip. A tap moves a chip to the first empty place and a tap
 * in the line puts it back; the last chip gives the answer, the chips'
 * places in the order tapped. Once the answer is judged, a right line turns
 * red and a wrong one sinks, nothing shaking; the screen plays the answer's
 * haptic. VoiceOver reads every chip by its text, the line's in the order
 * placed, and skips the empty places. A character that stays in place, such
 * as an apostrophe, is no chip: it shows in the line once the chips before
 * it are there. Key it by the Round, so a new Round starts with an empty
 * line.
 */
export function OrderedChips({
  chips,
  kind,
  fixed = [],
  answer,
  onAnswer,
}: {
  /** The chips, in the order shown. */
  chips: readonly string[];
  /** Whether the chips are a Word's letters or an expression's words, which sets their size. */
  kind: 'letter' | 'word';
  /** The characters that stay in place among the chips; none when left out. */
  fixed?: readonly FixedChip[] | undefined;
  /** The Round's answer, once given. */
  answer: ChipsAnswer | undefined;
  /** The places of the chips, in the order tapped, once every chip is in the line. */
  onAnswer: (chosen: number[]) => void;
}) {
  const [tapped, setTapped] = useState<readonly number[]>([]);
  const line = answer?.chosen ?? tapped;
  const judged: Judged = answer === undefined ? undefined : answer.right ? 'right' : 'wrong';

  return (
    <View testID="chips" style={styles.chips}>
      <View testID="chips-line" style={styles.line}>
        {chips.map((_, index) => {
          const place = line[index];
          return (
            <Fragment key={index}>
              {index <= line.length &&
                fixed
                  .filter(({ at }) => at === index)
                  .map(({ text }, mark) => <FixedMark key={mark} text={text} kind={kind} />)}
              {place === undefined ? (
                <EmptySlot index={index} kind={kind} />
              ) : (
                <LineChip
                  key={place}
                  index={index}
                  text={chips[place] ?? ''}
                  kind={kind}
                  judged={judged}
                  disabled={answer !== undefined}
                  onPress={() => {
                    setTapped(tapped.filter((other) => other !== place));
                  }}
                />
              )}
            </Fragment>
          );
        })}
        {line.length === chips.length &&
          fixed
            .filter(({ at }) => at === chips.length)
            .map(({ text }, mark) => <FixedMark key={mark} text={text} kind={kind} />)}
      </View>
      <View style={styles.tray}>
        {chips.map((text, place) => {
          const placed = line.includes(place);
          return (
            <Chip
              key={place}
              testID={`chips-${String(place)}`}
              text={text}
              kind={kind}
              placed={placed}
              inert={placed || answer !== undefined}
              onPress={() => {
                const next = [...tapped, place];
                setTapped(next);
                if (next.length === chips.length) onAnswer(next);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

/** An empty place of the answer line, dashed, which VoiceOver skips. It carries `chips-slot-${index}`. */
function EmptySlot({ index, kind }: { index: number; kind: 'letter' | 'word' }) {
  const { colors } = useTokens();
  return (
    <View
      testID={`chips-slot-${String(index)}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.slot,
        kind === 'letter' ? styles.letter : styles.word,
        { borderColor: colors.line, borderStyle: 'dashed' },
      ]}
    />
  );
}

/**
 * A chip among the shuffled ones, on a pressed tile. Once placed in the line
 * it stays faint in its place, takes no tap, and VoiceOver skips it.
 */
function Chip({
  testID,
  text,
  kind,
  placed,
  inert,
  onPress,
}: {
  testID: string;
  text: string;
  kind: 'letter' | 'word';
  placed: boolean;
  inert: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      accessibilityElementsHidden={placed}
      importantForAccessibility={placed ? 'no-hide-descendants' : 'auto'}
      style={placed && styles.placed}
      {...voice}
    >
      <PressedTile
        testID={testID}
        radius={CHIP_RADIUS}
        accessibilityLabel={text}
        accessibilityState={{ disabled: inert }}
        inert={inert}
        onPress={onPress}
        faceStyle={[styles.chip, kind === 'letter' ? styles.letter : styles.word]}
      >
        <ChipText text={text} kind={kind} color={colors.ink} />
      </PressedTile>
    </View>
  );
}

/**
 * A chip in the answer line, in a place bordered in ink. A right answer
 * turns the line red, a wrong one sinks it; nothing shakes.
 */
function LineChip({
  index,
  text,
  kind,
  judged,
  disabled,
  onPress,
}: {
  /** Its place in the line. */
  index: number;
  text: string;
  kind: 'letter' | 'word';
  judged: Judged;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTokens();
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  /** 0 before the answer, 1 once the chip has turned. */
  const turned = useSharedValue(judged === undefined ? 0 : 1);
  // Whether the chip showed the answer before, so only the answer given now moves it.
  const shownJudged = useRef(judged !== undefined);

  useEffect(() => {
    if (judged === undefined || shownJudged.current) return;
    shownJudged.current = true;
    turned.value = withTiming(1, judged === 'right' ? RIGHT_FILL : WRONG_FILL);
    // The shared value is stable, so only the answer given turns the chip.
  }, [judged, turned]);

  const face = judged === 'right' ? colors.accent : colors.surfaceSunken;
  const border = judged === 'right' ? colors.accentEdge : colors.ink;
  const motion = useAnimatedStyle(() =>
    judged === undefined
      ? {}
      : {
          backgroundColor: interpolateColor(turned.value, [0, 1], [colors.tile, face]),
          borderColor: interpolateColor(turned.value, [0, 1], [colors.ink, border]),
        },
  );
  return (
    <AnimatedPressable
      testID={`chips-line-${String(index)}`}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled }}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.slot,
        kind === 'letter' ? styles.letter : styles.word,
        { backgroundColor: colors.tile, borderColor: colors.ink, borderStyle: 'solid' },
        motion,
      ]}
    >
      <ChipText text={text} kind={kind} color={judged === 'right' ? keyInk : colors.ink} />
    </AnimatedPressable>
  );
}

/** A character in place in the answer line, such as an apostrophe: no chip, never tapped. */
function FixedMark({ text, kind }: { text: string; kind: 'letter' | 'word' }) {
  const { colors } = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.mark} {...voice}>
      <ChipText text={text} kind={kind} color={colors.ink} />
    </View>
  );
}

function ChipText({ text, kind, color }: { text: string; kind: 'letter' | 'word'; color: string }) {
  const tokens = useTokens();
  return (
    <Text
      maxFontSizeMultiplier={CHIP_MAX_FONT_SCALE}
      style={[typeStyle(kind === 'letter' ? 'chipLetter' : 'chipWord', tokens), { color }]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  chips: { gap: LINE_GAP },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: CHIP_GAP,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: CHIP_GAP,
  },
  slot: {
    height: SLOT_HEIGHT,
    borderWidth: SLOT_BORDER,
    borderRadius: CHIP_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: { height: CHIP_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  letter: { minWidth: CHIP_WIDTH, paddingHorizontal: space[1] },
  word: { minWidth: CHIP_WIDTH, paddingHorizontal: space[4] },
  placed: { opacity: PLACED_OPACITY },
  mark: { height: SLOT_HEIGHT, justifyContent: 'center' },
});
