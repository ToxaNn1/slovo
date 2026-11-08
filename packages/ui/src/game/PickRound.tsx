'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import {
  stressLabel,
  type GivenAnswer,
  type Round,
  type RoundAnswer,
  type RoundOption,
  type TextRange,
} from '@slovo/core';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { PressedTile } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { answerOption, roundLayout, space, typeStyle, type TypeRole } from '../tokens';
import { RoundCard, type RoundFace } from './RoundCard';
import { RIGHT_FILL, WRONG_FILL } from './round-motion';

/** The answer to a Round of the pick form. */
type PickAnswer = Extract<RoundAnswer, { form: 'pick' }>;

/** The ✕ on a wrong pick's key in place of its letter, drawn on a 14-unit square as the Round's exit glyph, so it sits in the key's centre whatever the font. */
const WRONG_MARK = 'M0 2L2 0L7 5L12 0L14 2L9 7L14 12L12 14L7 9L2 14L0 12L5 7Z';

/**
 * The type role an option's text takes, its tier: a Word is one word, a
 * sentence runs to `answerOption.sentenceMost` characters, a long text past
 * that.
 */
function optionRole(text: string): TypeRole {
  if (!/\s/u.test(text.trim())) return 'roundOptionWord';
  return Array.from(text).length <= answerOption.sentenceMost
    ? 'roundOptionSentence'
    : 'roundOptionLong';
}

/**
 * A Round of the pick form: the prompt on its card under the Round's head,
 * then the four options, which show the answer once it is given.
 */
export function PickRound({
  round,
  label,
  prompt,
  highlight,
  face,
  onAnswer,
}: {
  round: Extract<Round, { form: 'pick' }>;
  /** The label the card reads over the prompt. */
  label: string;
  prompt: string;
  /** The part of the prompt to mark, the Round's own unless its look moves it. */
  highlight: TextRange | undefined;
  /** The restyled look of the Round's card; the plain prompt if none. */
  face: RoundFace | undefined;
  onAnswer: (given: Extract<GivenAnswer, { form: 'pick' }>) => void;
}) {
  return (
    <>
      <RoundCard
        label={label}
        prompt={prompt}
        highlight={highlight}
        gap={round.gap}
        definition={round.definition}
        face={face}
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
  const keys = Array.from(useEdition().strings.game.round.optionKeys);
  return (
    <View style={styles.options}>
      {options.map((option, place) => (
        <AnswerOption
          key={String(place)}
          option={option}
          place={place}
          optionKey={keys[place]}
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
 * One option of a Round, board 07's answer tile, 66 pt tall, its key at its
 * left and its text sized for its tier. Once the Round is answered, the right
 * option turns red and pops; a wrong choice sinks, mutes and drops, with ✕ on
 * its key; the others fade. Under Reduce Motion nothing pops or drops.
 * Nothing shakes. VoiceOver reads the option with its Stress, then
 * «Правильно» or «Твій вибір», and the faded ones as dimmed.
 */
function AnswerOption({
  option,
  place,
  optionKey,
  answer,
  onPress,
}: {
  option: RoundOption;
  /** Its place among the options. */
  place: number;
  /** Its key, such as «А»; none past the Edition's keys. */
  optionKey: string | undefined;
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
  // Whether the option showed an answer before, so only the answer given now moves.
  const shownAnswered = useRef(answer !== undefined);

  useEffect(() => {
    if (look === 'rest' || shownAnswered.current) return;
    shownAnswered.current = true;
    answered.value = withTiming(1, look === 'right' ? RIGHT_FILL : WRONG_FILL);
    // The shared value is stable, so only the answer given moves the option.
  }, [look, answered]);

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
  const role = optionRole(option.text);
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
        {optionKey !== undefined && (
          <View
            style={[
              styles.key,
              { borderColor: look === 'right' ? keyInk : colors.ink },
              look === 'wrong' && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          >
            {look === 'wrong' ? (
              <Svg
                testID={`${testID}-wrong-mark`}
                width={answerOption.key.wrongMark}
                height={answerOption.key.wrongMark}
                viewBox="0 0 14 14"
              >
                <Path d={WRONG_MARK} fill={colors.onAccent} />
              </Svg>
            ) : (
              <Text
                style={[
                  typeStyle('roundOptionKey', tokens),
                  { color: look === 'right' ? keyInk : colors.ink },
                ]}
              >
                {optionKey}
              </Text>
            )}
          </View>
        )}
        <View style={styles.optionText}>
          <WholeWordsText
            text={option.text}
            typeRole={role}
            style={[
              typeStyle(role, tokens),
              { color: look === 'right' ? keyInk : look === 'wrong' ? colors.muted : colors.ink },
            ]}
          />
        </View>
      </PressedTile>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  options: { gap: roundLayout.gap },
  option: {
    minHeight: answerOption.minHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: answerOption.key.gap,
    paddingVertical: space[2],
    paddingLeft: answerOption.paddingLeft,
    paddingRight: answerOption.paddingRight,
  },
  optionText: { flex: 1 },
  key: {
    width: answerOption.key.side,
    height: answerOption.key.side,
    borderRadius: answerOption.key.radius,
    borderWidth: answerOption.key.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
