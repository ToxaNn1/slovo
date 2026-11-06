'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import {
  stressLabel,
  type GivenAnswer,
  type Round,
  type RoundAnswer,
  type RoundOption,
} from '@slovo/core';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { PressedTile } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { answerOption, badgeStamp, motion, roundLayout, space, typeStyle } from '../tokens';
import { RoundCard } from './RoundCard';
import { RIGHT_FILL, WRONG_FILL } from './round-motion';

/** The answer to a Round of the pick form. */
type PickAnswer = Extract<RoundAnswer, { form: 'pick' }>;

/** The stamp lands as the Badge's does (`motion.stamp`). */
const STAMP_LANDING = {
  duration: motion.stamp.duration,
  easing: Easing.bezier(...motion.stamp.easing),
  reduceMotion: ReduceMotion.Never,
};
/** The slash on a wrong choice is drawn in 300 ms, the board's `slSlash`. */
const SLASH_DRAWING = {
  duration: 300,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};

/**
 * A Round of the pick form: the prompt on its card under the Round's head,
 * then the four options, which show the answer once it is given.
 */
export function PickRound({
  round,
  label,
  prompt,
  onAnswer,
}: {
  round: Extract<Round, { form: 'pick' }>;
  /** The label the card reads over the prompt. */
  label: string;
  prompt: string;
  onAnswer: (given: Extract<GivenAnswer, { form: 'pick' }>) => void;
}) {
  return (
    <>
      <RoundCard
        label={label}
        prompt={prompt}
        highlight={round.highlight}
        gap={round.gap}
        definition={round.definition}
      />
      <AnswerOptions
        key={round.number}
        options={round.options}
        answer={round.answer?.form === 'pick' ? round.answer : undefined}
        onPick={(option) => {
          onAnswer({ form: 'pick', option });
        }}
      />
    </>
  );
}

/**
 * The options of a pick Round, one under another, as a Game's Round and a
 * Quick Question show them; a new set of options takes a new `key`.
 */
export function AnswerOptions({
  options,
  answer,
  onPick,
}: {
  options: readonly RoundOption[];
  /** The option picked and the right one, once the Round is answered. */
  answer: Pick<PickAnswer, 'chosen' | 'correct'> | undefined;
  onPick: (option: number) => void;
}) {
  return (
    <View style={styles.options}>
      {options.map((option, place) => (
        <AnswerOption
          key={String(place)}
          option={option}
          place={place}
          answer={answer}
          onPress={() => {
            onPick(place);
          }}
        />
      ))}
    </View>
  );
}

/**
 * One option of a Round, the design's answer tile, 84 pt tall. Once the
 * Round is answered, the right option turns red, pops and takes the ink
 * stamp of a tick; a wrong choice sinks, mutes, drops and is struck through
 * with a red slash; the others fade. Under Reduce Motion nothing pops,
 * drops or slides: the stamp and the slash appear in place. Nothing shakes.
 * VoiceOver reads the option with its Stress, then «Правильно» or «Твій
 * вибір», and the faded ones as dimmed.
 */
function AnswerOption({
  option,
  place,
  answer,
  onPress,
}: {
  option: RoundOption;
  /** Its place among the options. */
  place: number;
  /** The Round's answer, once given. */
  answer: Pick<PickAnswer, 'chosen' | 'correct'> | undefined;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const look =
    answer === undefined
      ? 'rest'
      : place === answer.correct
        ? 'right'
        : place === answer.chosen
          ? 'wrong'
          : 'dimmed';
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the option has popped, dropped or faded. */
  const answered = useSharedValue(answer === undefined ? 0 : 1);
  /** 0 before the answer, 1 once the stamp has landed or the slash is drawn. */
  const marked = useSharedValue(answer === undefined ? 0 : 1);
  // Whether the option showed an answer before, so only the answer given now moves.
  const shownAnswered = useRef(answer !== undefined);

  useEffect(() => {
    if (look === 'rest' || shownAnswered.current) return;
    shownAnswered.current = true;
    answered.value = withTiming(1, look === 'right' ? RIGHT_FILL : WRONG_FILL);
    marked.value = withTiming(1, look === 'right' ? STAMP_LANDING : SLASH_DRAWING);
    // The shared values are stable, so only the answer given moves the option.
  }, [look, answered, marked]);

  const still = reduceMotion || look === 'rest';
  const optionMotion = useAnimatedStyle(() => {
    if (look === 'dimmed')
      return { opacity: 1 - (1 - answerOption.dimmedOpacity) * answered.value, transform: [] };
    if (look === 'wrong')
      return {
        opacity: 1,
        transform: still ? [] : [{ translateY: answerOption.drop * answered.value }],
      };
    return {
      opacity: 1,
      transform: still
        ? []
        : [{ scale: interpolate(answered.value, [0, 0.6, 1], [...answerOption.pop]) }],
    };
  });
  const testID = `game-option-${String(place)}`;
  return (
    <Animated.View testID={`${testID}-motion`} style={optionMotion} {...voice}>
      <PressedTile
        testID={testID}
        tone={look === 'right' ? 'accent' : look === 'wrong' ? 'none' : 'tile'}
        radius={answerOption.radius}
        accessibilityLabel={[
          stressLabel(strings.wordCard, option.text, option.stressedVowels),
          look === 'right'
            ? strings.game.round.correct
            : look === 'wrong'
              ? strings.game.round.chosen
              : undefined,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityState={{ disabled: look === 'dimmed' }}
        inert={answer !== undefined}
        onPress={onPress}
        faceStyle={[styles.option, look === 'wrong' && { backgroundColor: colors.surfaceSunken }]}
      >
        <View style={styles.optionText}>
          <WholeWordsText
            text={option.text}
            typeRole="roundOption"
            style={[
              typeStyle('roundOption', tokens),
              { color: look === 'right' ? keyInk : look === 'wrong' ? colors.muted : colors.ink },
            ]}
          />
        </View>
        {look === 'right' && (
          <Stamp landed={marked} still={reduceMotion} ink={keyInk} testID={testID} />
        )}
        {look === 'wrong' && (
          <Slash drawn={marked} still={reduceMotion} color={colors.accent} testID={testID} />
        )}
      </PressedTile>
    </Animated.View>
  );
}

/**
 * The ink stamp on a right option: a tick in a ring, turned, that lands from
 * large and turned further (the Badge stamp's landing); under Reduce Motion
 * it fades in at rest. It carries `${testID}-stamp`.
 */
function Stamp({
  landed,
  still,
  ink,
  testID,
}: {
  landed: SharedValue<number>;
  still: boolean;
  ink: string;
  testID: string;
}) {
  const stampMotion = useAnimatedStyle(() => {
    const opacity = interpolate(landed.value, [0, 0.7], [0, 1], Extrapolation.CLAMP);
    if (still) return { opacity, transform: [{ rotate: `${String(badgeStamp.turn)}deg` }] };
    const scale = interpolate(landed.value, [0, 0.7, 1], [badgeStamp.from.scale, 0.92, 1]);
    const turn = interpolate(
      landed.value,
      [0, 0.7],
      [badgeStamp.from.turn, badgeStamp.turn],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }, { rotate: `${String(turn)}deg` }] };
  });
  return (
    <Animated.View
      testID={`${testID}-stamp`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.stamp, { borderColor: ink }, stampMotion]}
    >
      <Svg width={answerOption.tick.width} height={answerOption.tick.height} viewBox="0 0 26 22">
        <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={ink} />
      </Svg>
    </Animated.View>
  );
}

/**
 * The red slash across a wrong choice, a little turned, drawn from the left;
 * under Reduce Motion it fades in whole. Its line carries `${testID}-slash`.
 */
function Slash({
  drawn,
  still,
  color,
  testID,
}: {
  drawn: SharedValue<number>;
  still: boolean;
  color: string;
  testID: string;
}) {
  const slashMotion = useAnimatedStyle(() =>
    still
      ? { opacity: drawn.value, transform: [{ scaleX: 1 }] }
      : { opacity: 1, transform: [{ scaleX: Math.min(drawn.value, 1) }] },
  );
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.slashTrack}
    >
      <Animated.View
        testID={`${testID}-slash`}
        style={[styles.slash, { backgroundColor: color }, slashMotion]}
      />
    </View>
  );
}

const { stamp, slash } = answerOption;

const styles = StyleSheet.create({
  options: { gap: roundLayout.gap },
  option: {
    minHeight: answerOption.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[2],
    paddingLeft: answerOption.paddingLeft,
    paddingRight: stamp.side + stamp.right + space[2],
  },
  optionText: { flex: 1 },
  stamp: {
    position: 'absolute',
    right: stamp.right,
    top: stamp.top,
    width: stamp.side,
    height: stamp.side,
    borderWidth: stamp.border,
    borderRadius: stamp.side / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashTrack: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    paddingHorizontal: slash.inset,
    transform: [{ rotate: `${String(slash.turn)}deg` }],
  },
  slash: { height: slash.thickness, transformOrigin: 'left' },
});
