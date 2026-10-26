import type { RoundAnswer } from '@slovo/core';
import { useEffect, useRef, useState } from 'react';
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
import { minTouchTarget, onFill, roundLayout, space, typeSize } from '../tokens';
import { RIGHT_FILL, shake, WRONG_FILL } from './round-motion';

/** A chip's height, above the 44 pt touch target. */
const CHIP_HEIGHT = 52;
/** How far the largest text sizes of iOS may scale a chip's text, so a chip never breaks a word. */
const CHIP_MAX_FONT_SCALE = 1.5;
/** A word chip's text, smaller than a letter's so an expression of 8 words fits. */
const WORD_SIZE = typeSize.listItem;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The answer to a Round of the chips form. */
type ChipsAnswer = Extract<RoundAnswer, { form: 'chips' }>;

/**
 * The chips of a Round of the chips form, letters of a Word or words of an
 * expression, shuffled, and the answer line over them. A tap moves a chip to
 * the end of the line and a tap in the line puts it back; the last chip gives
 * the answer, the chips' places in the order tapped. Once the answer is
 * judged, a right line fills in the correct colour and, in a wrong one, the
 * first chip out of place fills in the wrong colour and shakes, which Reduce
 * Motion leaves out; the screen plays the answer's haptic. VoiceOver reads
 * every chip by its text, the line's in the order placed. Key it by the Round,
 * so a new Round starts with an empty line.
 */
export function OrderedChips({
  chips,
  kind,
  answer,
  onAnswer,
}: {
  /** The chips, in the order shown. */
  chips: readonly string[];
  /** Whether the chips are a Word's letters or an expression's words, which sets their size. */
  kind: 'letter' | 'word';
  /** The Round's answer, once given. */
  answer: ChipsAnswer | undefined;
  /** The places of the chips, in the order tapped, once every chip is in the line. */
  onAnswer: (chosen: number[]) => void;
}) {
  const [tapped, setTapped] = useState<readonly number[]>([]);
  const line = answer?.chosen ?? tapped;
  const wrongAt =
    answer === undefined || answer.right
      ? undefined
      : line.findIndex((place, index) => chips[place] !== answer.expected[index]);

  return (
    <View testID="chips" style={styles.chips}>
      <View testID="chips-line" style={styles.line}>
        <LineRule />
        {line.map((place, index) => (
          <LineChip
            key={place}
            index={index}
            text={chips[place] ?? ''}
            kind={kind}
            fill={
              answer === undefined
                ? undefined
                : answer.right
                  ? 'right'
                  : wrongAt === index
                    ? 'wrong'
                    : undefined
            }
            disabled={answer !== undefined}
            onPress={() => {
              setTapped(tapped.filter((other) => other !== place));
            }}
          />
        ))}
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
              disabled={placed || answer !== undefined}
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

/** The rule the answer line's chips stand on, under them across the line. */
function LineRule() {
  const { colors } = useTokens();
  return <View style={[styles.rule, { backgroundColor: colors.line }]} />;
}

/**
 * A chip among the shuffled ones. Once placed in the line it leaves an empty
 * place of its size, which VoiceOver skips.
 */
function Chip({
  testID,
  text,
  kind,
  placed,
  disabled,
  onPress,
}: {
  testID: string;
  text: string;
  kind: 'letter' | 'word';
  placed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled }}
      accessibilityElementsHidden={placed}
      importantForAccessibility={placed ? 'no-hide-descendants' : 'auto'}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        kind === 'letter' ? styles.letter : styles.word,
        {
          backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
          borderColor: colors.line,
          borderRadius: radii.button,
        },
        placed && styles.placed,
      ]}
    >
      <ChipText text={text} kind={kind} color={colors.ink} />
    </Pressable>
  );
}

/**
 * A chip in the answer line. A judged answer fills it in the correct or the
 * wrong colour, and the wrong one shakes, but with Reduce Motion.
 */
function LineChip({
  index,
  text,
  kind,
  fill,
  disabled,
  onPress,
}: {
  /** Its place in the line. */
  index: number;
  text: string;
  kind: 'letter' | 'word';
  /** How the judged answer fills it; nothing before the answer or for a chip in place in a wrong one. */
  fill: 'right' | 'wrong' | undefined;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, radii } = useTokens();
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the chip has filled. */
  const filled = useSharedValue(fill === undefined ? 0 : 1);
  const shift = useSharedValue(0);
  // Whether the chip showed its fill before, so only the answer given now moves it.
  const shownFill = useRef(fill !== undefined);

  useEffect(() => {
    if (fill === undefined || shownFill.current) return;
    shownFill.current = true;
    filled.value = withTiming(1, fill === 'right' ? RIGHT_FILL : WRONG_FILL);
    if (fill === 'wrong' && !reduceMotion) shift.value = shake();
    // The shared values are stable, and a change of Reduce Motion finds the
    // answer already shown, so only the answer given moves the chip.
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
    <AnimatedPressable
      testID={`chips-line-${String(index)}`}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled }}
      {...voice}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        kind === 'letter' ? styles.letter : styles.word,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.button },
        motion,
      ]}
    >
      <ChipText text={text} kind={kind} color={fill === undefined ? colors.ink : onFill} />
    </AnimatedPressable>
  );
}

function ChipText({ text, kind, color }: { text: string; kind: 'letter' | 'word'; color: string }) {
  const { fontFamilies } = useTokens();
  return (
    <Text
      maxFontSizeMultiplier={CHIP_MAX_FONT_SCALE}
      style={[
        kind === 'letter' ? styles.letterText : styles.wordText,
        { color, fontFamily: fontFamilies.word },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space[8] },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: roundLayout.tightGap,
    minHeight: CHIP_HEIGHT + space[2],
    paddingBottom: space[2],
  },
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: roundLayout.gap,
  },
  chip: {
    minHeight: CHIP_HEIGHT,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  letter: { paddingHorizontal: space[3] },
  word: { paddingHorizontal: space[4] },
  placed: { opacity: 0 },
  letterText: { fontSize: typeSize.roundOption, fontWeight: '500' },
  wordText: { fontSize: WORD_SIZE, fontWeight: '500' },
});
