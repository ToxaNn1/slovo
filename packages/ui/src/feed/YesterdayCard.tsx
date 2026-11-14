'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { stressLabel, type WordCardModel, type YesterdayQuiz } from '@slovo/core';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { capitalised } from '../entries/capitalised';
import { useGameHaptics } from '../game/useGameHaptics';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { PressedTile } from '../primitives/PressedTile';
import { bezier } from '../primitives/timing';
import { useCascade } from '../primitives/useCascade';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { motion, typeStyle, yesterdayCard } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

const { option: optionSize, pop, wrong } = yesterdayCard;
const popEasing = bezier(motion.pop.easing);
const still = { reduceMotion: ReduceMotion.Never } as const;

/** How an option looks: before a pick, the right one lit red, the wrong one picked, or another faded. */
type OptionLook = 'rest' | 'right' | 'wrong' | 'dimmed';

/**
 * Yesterday «Пам’ятаєш учорашнє слово?» (board f5): the day before's Word of
 * the Day, its Lemma in red, and three meanings to pick its own from (ADR
 * 0130). A right pick lights its option red with a check and pops it,
 * «Влучно!» under the options; a wrong one turns its option ink, struck
 * through with a cross, sunk and shaken, the right one lights a moment
 * later, the rest fade, «Майже. Наступне вийде.». A second tap on the picked
 * option clears the pick, and another option can be picked, as on the board;
 * only the first pick goes to `onAnswer`, the rest change the look alone.
 * It rises in; under Reduce Motion it fades in and nothing pops or shakes.
 */
export function YesterdayCard({
  word,
  quiz,
  onAnswer,
}: {
  word: WordCardModel;
  quiz: YesterdayQuiz;
  /** Told the reader's first pick, the place of the meaning among `quiz.meanings`. */
  onAnswer: (option: number) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const turnActions = usePageTurnActions();
  const gameHaptics = useGameHaptics();
  const entered = useCascade(0, {
    variant: 'rise',
    stagger: 0,
    duration: yesterdayCard.enter.duration,
    delay: yesterdayCard.enter.delay,
  });
  const [chosen, setChosen] = useState(quiz.answered);
  // The wrong pick the right option has lit for, a moment after it.
  const [litFor, setLitFor] = useState(quiz.answered);
  const answered = useRef(quiz.answered !== undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const choose = (place: number) => {
    const next = chosen === place ? undefined : place;
    setChosen(next);
    clearTimeout(timer.current);
    if (next === undefined) return;
    if (next === quiz.right) gameHaptics.rightAnswer();
    else {
      gameHaptics.wrongAnswer();
      timer.current = setTimeout(() => {
        setLitFor(next);
      }, wrong.lightDelay);
    }
    if (answered.current) return;
    answered.current = true;
    onAnswer(next);
  };
  const lookOf = (place: number): OptionLook => {
    if (chosen === undefined) return 'rest';
    if (place === quiz.right) return chosen === quiz.right || litFor === chosen ? 'right' : 'rest';
    return place === chosen ? 'wrong' : 'dimmed';
  };
  const title = strings.feedNotices.yesterday.title;
  const verdict =
    chosen === undefined
      ? ''
      : chosen === quiz.right
        ? strings.feedNotices.yesterday.right
        : strings.feedNotices.yesterday.wrong;
  return (
    <Animated.View style={entered}>
      <FeedNoticeCard notice="yesterday" gap={yesterdayCard.gap}>
        <Text
          accessibilityRole="header"
          {...voice}
          {...turnActions}
          style={[typeStyle('yesterdayTitle', tokens), { color: colors.ink }]}
        >
          {title}
        </Text>
        <Text
          {...voice}
          accessibilityLabel={stressLabel(strings.wordCard, word.lemma, word.stressedVowels)}
          style={[typeStyle('yesterdayLemma', tokens), { color: colors.accent }]}
        >
          {capitalised(word.lemma, voice.accessibilityLanguage)}
        </Text>
        <View style={styles.options}>
          {quiz.meanings.map((meaning, place) => (
            <QuizOption
              key={String(place)}
              meaning={meaning}
              place={place}
              look={lookOf(place)}
              onPress={() => {
                choose(place);
              }}
            />
          ))}
        </View>
        <Text
          testID="yesterday-verdict"
          accessibilityLiveRegion="polite"
          {...voice}
          style={[
            typeStyle('yesterdayVerdict', tokens),
            styles.verdict,
            { color: chosen === quiz.right ? colors.accent : colors.ink },
          ]}
        >
          {verdict}
        </Text>
      </FeedNoticeCard>
    </Animated.View>
  );
}

/**
 * One meaning of the quiz on its tile, as `look` says; a look it turns to
 * plays its motion once: the right one pops, the wrong one shakes.
 */
function QuizOption({
  meaning,
  place,
  look,
  onPress,
}: {
  meaning: string;
  place: number;
  look: OptionLook;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const shown = useRef(look);
  useEffect(() => {
    if (shown.current === look) return;
    shown.current = look;
    if (reduceMotion) return;
    if (look === 'right')
      scale.value = withSequence(
        withTiming(pop.from, { duration: 0, ...still }),
        withTiming(pop.peak, { duration: pop.duration * pop.peakAt, easing: popEasing, ...still }),
        withTiming(1, { duration: pop.duration * (1 - pop.peakAt), easing: popEasing, ...still }),
      );
    if (look === 'wrong')
      shake.value = withSequence(
        ...wrong.shake.map((to) =>
          withTiming(to, { duration: wrong.duration / wrong.shake.length, ...still }),
        ),
      );
  }, [look, reduceMotion, scale, shake]);
  const optionMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: scale.value }],
  }));
  const ink = look === 'right' ? keyInk : look === 'wrong' ? colors.background : colors.ink;
  const testID = `yesterday-option-${String(place)}`;
  return (
    <View
      testID={`${testID}-place`}
      style={[look === 'dimmed' && styles.dimmed, look === 'wrong' && styles.sunk]}
    >
      <Animated.View testID={`${testID}-motion`} style={optionMotion}>
        <PressedTile
          testID={testID}
          tone={look === 'right' ? 'accent' : look === 'wrong' ? 'none' : 'tile'}
          radius={optionSize.radius}
          accessibilityLabel={[
            meaning,
            look === 'right'
              ? strings.game.round.correct
              : look === 'wrong'
                ? strings.game.round.chosen
                : undefined,
          ]
            .filter(Boolean)
            .join(', ')}
          accessibilityState={{ selected: look === 'wrong' || look === 'right' }}
          onPress={onPress}
          faceStyle={[
            styles.option,
            {
              borderColor: look === 'rest' || look === 'dimmed' ? colors.line : 'transparent',
            },
            look === 'wrong' && { backgroundColor: colors.ink },
          ]}
        >
          <Text
            {...voice}
            style={[
              typeStyle('yesterdayOption', tokens),
              styles.meaning,
              { color: ink },
              look === 'wrong' && styles.struck,
            ]}
          >
            {meaning}
          </Text>
          {look === 'right' && (
            <Svg
              testID={`${testID}-check`}
              width={optionSize.check.width}
              height={optionSize.check.height}
              viewBox="0 0 26 22"
            >
              <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={ink} />
            </Svg>
          )}
          {look === 'wrong' && (
            <Svg
              testID={`${testID}-cross`}
              width={optionSize.cross}
              height={optionSize.cross}
              viewBox="0 0 20 20"
            >
              <Polygon
                points="3,0 10,7 17,0 20,3 13,10 20,17 17,20 10,13 3,20 0,17 7,10 0,3"
                fill={ink}
              />
            </Svg>
          )}
        </PressedTile>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  options: { gap: yesterdayCard.optionGap },
  option: {
    minHeight: optionSize.height,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: optionSize.gap,
    paddingHorizontal: optionSize.padding,
    borderWidth: optionSize.border,
  },
  meaning: { flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
  dimmed: { opacity: yesterdayCard.dimmedOpacity },
  sunk: { transform: [{ translateY: wrong.sink }] },
  verdict: { minHeight: yesterdayCard.verdictHeight },
});
