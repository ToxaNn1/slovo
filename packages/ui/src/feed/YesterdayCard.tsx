'use no memo';
// Reanimated code: the React Compiler skips this module.

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
import { entryCardFrame, swipeStampLayout, typeStyle, yesterdayCard } from '../tokens';
import { FeedNoticeCard } from './FeedNoticeCard';

/**
 * Yesterday «Пам’ятаєш учорашнє слово?» (board f5): the day before's Word of
 * the Day, its Lemma in red, and three meanings to pick its own from. A right pick lights its option red with a check and pops it,
 * «Влучно!» under the options; a wrong one turns its option ink, struck
 * through with a cross, sunk and shaken, the right one lights a moment
 * later, the rest fade, «Майже. Наступне вийде.». A second tap on the picked
 * option clears the pick, and another option can be picked, as on the board;
 * only the first pick goes to `onAnswer`, the rest change the look alone.
 * It rises in; under Reduce Motion it fades in and nothing pops or shakes.
 * Filled, the question sits at the top of the card and the options with the
 * verdict at its bottom, the free room between them.
 */
export function YesterdayCard({
  word,
  quiz,
  onAnswer,
  fill,
}: {
  word: WordCardModel;
  quiz: YesterdayQuiz;
  /** Told the reader's first pick, the place of the meaning among `quiz.meanings`. */
  onAnswer: (option: number) => void;
  /**
   * `page`: on a page of its own the card is a Word card's height (owner 15.11, 23.11);
   * `rest`: it fills what the page leaves it, under the Weekly Recap.
   */
  fill?: 'page' | 'rest' | undefined;
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
    <Animated.View
      testID="yesterday"
      style={[entered, fill !== undefined && styles.fill, fill === 'page' && styles.wordCardHeight]}
    >
      <FeedNoticeCard notice="yesterday" gap={yesterdayCard.gap} fill={fill !== undefined}>
        <View style={styles.part}>
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
        </View>
        <View testID="yesterday-answers" style={[styles.part, fill !== undefined && styles.bottom]}>
          <View testID="yesterday-options" style={styles.options}>
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
        </View>
      </FeedNoticeCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Ends where a framed Word card's face ends: over the room it leaves for the swipe stamp
  // and its offset shadow, as the Quick Question does (owner, 23.11).
  wordCardHeight: { paddingBottom: swipeStampLayout.room + entryCardFrame.shadow },
  part: { gap: yesterdayCard.gap },
  // The auto margin takes the free room, so the answers sit at the card's bottom (owner, 23.11).
  bottom: { marginTop: 'auto' },
  // A clear gap from the bottom of an option's edge to the next option (owner, 16.11).
  options: { gap: yesterdayCard.optionGap },
  verdict: { minHeight: yesterdayCard.verdictHeight },
});
