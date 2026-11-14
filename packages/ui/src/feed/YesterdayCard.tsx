'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { stressLabel, type WordCardModel, type YesterdayQuiz } from '@slovo/core';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { capitalised } from '../entries/capitalised';
import { useGameHaptics } from '../game/useGameHaptics';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { QuizOption, type QuizOptionLook } from '../primitives/QuizOption';
import { useCascade } from '../primitives/useCascade';
import { usePageTurnActions } from '../primitives/VerticalPager';
import { typeStyle, yesterdayCard } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

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
    // Each pick lights the right one afresh, a moment after it.
    setLitFor(undefined);
    clearTimeout(timer.current);
    if (next === undefined) return;
    if (next === quiz.right) gameHaptics.rightAnswer();
    else {
      gameHaptics.wrongAnswer();
      timer.current = setTimeout(() => {
        setLitFor(next);
      }, yesterdayCard.lightDelay);
    }
    if (answered.current) return;
    answered.current = true;
    onAnswer(next);
  };
  const lookOf = (place: number): QuizOptionLook => {
    if (chosen === undefined) return 'rest';
    if (place === quiz.right) return chosen === quiz.right || litFor === chosen ? 'right' : 'rest';
    return place === chosen ? 'wrong' : 'dimmed';
  };
  const optionLabel = (meaning: string, look: QuizOptionLook) =>
    [
      meaning,
      look === 'right'
        ? strings.game.round.correct
        : look === 'wrong'
          ? strings.game.round.chosen
          : undefined,
    ]
      .filter(Boolean)
      .join(', ');
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
              testID={`yesterday-option-${String(place)}`}
              meaning={meaning}
              look={lookOf(place)}
              accessibilityLabel={optionLabel(meaning, lookOf(place))}
              picked={place === chosen}
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

const styles = StyleSheet.create({
  options: { gap: yesterdayCard.optionGap },
  verdict: { minHeight: yesterdayCard.verdictHeight },
});
