import type { DueQuestion } from '@slovo/core';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import { capitalised } from '../entries/capitalised';
import { useGameHaptics } from '../game/useGameHaptics';
import { fill, useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { Button } from '../primitives/Button';
import { QuizOption, type QuizOptionLook } from '../primitives/QuizOption';
import { TitledSheet } from '../primitives/TitledSheet';
import { dueQuiz, fontScaleCap, space, typeStyle } from '../tokens';

/**
 * The Due Quiz card «Перевір себе» over the «Вчу» list (board 09, screen
 * 73, ADR 0131): red, the number of Words behind its text, how many Words it
 * asks today and the ink «Почати», which presses down and opens the sheet.
 */
export function DueQuizCard({ count, onStart }: { count: number; onStart: () => void }) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const keyColors = useSchemeColors('light');
  const { strings, voice, count: countOf } = useEdition();
  const texts = strings.learning.dueQuiz;
  const line = countOf(texts.count, count);
  return (
    <View
      testID="due-quiz-card"
      style={[styles.card, { borderRadius: radii.card, backgroundColor: colors.accent }]}
    >
      <Text
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        maxFontSizeMultiplier={fontScaleCap.number}
        style={[typeStyle('dueQuizCount', tokens), styles.count, { color: keyColors.background }]}
      >
        {String(count)}
      </Text>
      <View
        accessible
        accessibilityLabel={fill(texts.cardLabel, { count: line })}
        style={styles.text}
      >
        <Text {...voice} style={[typeStyle('dueQuizTitle', tokens), { color: keyColors.ink }]}>
          {texts.title}
        </Text>
        <Text {...voice} style={[typeStyle('dueQuizLine', tokens), { color: keyColors.ink }]}>
          {line}
        </Text>
      </View>
      <Button
        variant="onAccent"
        size="small"
        label={texts.start}
        onPress={onStart}
        testID="due-quiz-start"
      />
    </View>
  );
}

/** What the toast says once the reader taps «Готово»: every answer right, or how many were. */
function useResultText(): (known: number, count: number) => string {
  const { strings, count: countOf } = useEdition();
  const { result } = strings.learning.dueQuiz;
  return (known, count) => {
    if (known < count) return fill(result.partial, { known: String(known), count: String(count) });
    if (count === 1) return result.allRight.single;
    if (count === 2) return result.allRight.both;
    return countOf(result.allRight.many, count);
  };
}

/**
 * The Due Quiz sheet (board 09, ADR 0131): «1 з N» and a segment per Word,
 * the Lemma, «Що це означає?» and its three meanings marked «А», «Б», «В».
 * The first pick is the answer, told to `onAnswer`: the right meaning lights
 * red and pops, a wrong pick turns ink, struck through, and shakes, the
 * right one lit too; then «Далі», or «Готово» after the last Word, which
 * hands `onDone` the toast's text. «Скасувати» asks `onClose`; the answers
 * given stay. It asks `questions` as they were when it opened.
 */
export function DueQuizSheet({
  visible,
  questions,
  onAnswer,
  onDone,
  onClose,
  onDismissed,
}: {
  visible: boolean;
  questions: readonly DueQuestion[];
  /** Told the reader's pick, the place of the meaning among the question's `meanings`. */
  onAnswer: (question: DueQuestion, option: number) => void;
  /** Told the toast's text on «Готово». */
  onDone: (result: string) => void;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const texts = strings.learning.dueQuiz;
  const gameHaptics = useGameHaptics();
  const resultText = useResultText();
  const [place, setPlace] = useState(0);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const [known, setKnown] = useState(0);
  const question = questions[Math.min(place, questions.length - 1)];
  const last = place >= questions.length - 1;
  const marks = [texts.options.first, texts.options.second, texts.options.third];

  const pick = (option: number) => {
    if (question === undefined || picked !== undefined) return;
    setPicked(option);
    const right = option === question.right;
    if (right) {
      setKnown((was) => was + 1);
      gameHaptics.rightAnswer();
    } else gameHaptics.wrongAnswer();
    AccessibilityInfo.announceForAccessibility(right ? texts.answered.right : texts.answered.wrong);
    onAnswer(question, option);
  };
  const next = () => {
    if (last) {
      onDone(resultText(known, questions.length));
      return;
    }
    setPlace(place + 1);
    setPicked(undefined);
  };
  const lookOf = (option: number): QuizOptionLook => {
    if (question === undefined || picked === undefined) return 'rest';
    if (option === question.right) return 'right';
    return option === picked ? 'wrong' : 'dimmed';
  };

  return (
    <TitledSheet
      visible={visible}
      title={texts.title}
      cancelLabel={texts.cancel}
      onClose={onClose}
      onDismissed={onDismissed}
      testID="due-quiz"
    >
      {question !== undefined && (
        <>
          <View style={styles.progress}>
            <Text
              {...voice}
              testID="due-quiz-progress"
              style={[typeStyle('dueQuizProgress', tokens), { color: colors.muted }]}
            >
              {fill(texts.progress, {
                index: String(place + 1),
                count: String(questions.length),
              })}
            </Text>
            <View style={styles.segments} importantForAccessibility="no-hide-descendants">
              {questions.map((each, at) => (
                <View
                  key={each.wordId}
                  style={[
                    styles.segment,
                    {
                      backgroundColor:
                        at < place ? colors.accent : at === place ? colors.ink : colors.line,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
          <Text
            {...voice}
            accessibilityRole="header"
            testID="due-quiz-lemma"
            style={[typeStyle('dueQuizLemma', tokens), { color: colors.ink }]}
          >
            {capitalised(question.lemma, voice.accessibilityLanguage)}
          </Text>
          <Text {...voice} style={[typeStyle('dueQuizQuestion', tokens), { color: colors.muted }]}>
            {texts.question}
          </Text>
          <View style={styles.options}>
            {question.meanings.map((meaning, option) => (
              <QuizOption
                key={`${question.wordId}-${String(option)}`}
                testID={`due-quiz-option-${String(option)}`}
                meaning={meaning}
                look={lookOf(option)}
                picked={option === picked}
                mark={marks[option]}
                minHeight={dueQuiz.optionHeight}
                accessibilityLabel={fill(texts.optionLabel, {
                  option: marks[option] ?? '',
                  meaning,
                })}
                onPress={() => {
                  pick(option);
                }}
              />
            ))}
          </View>
          {picked !== undefined && (
            <Button
              variant="inverse"
              label={last ? texts.done : texts.next}
              onPress={next}
              testID="due-quiz-next"
            />
          )}
        </>
      )}
    </TitledSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dueQuiz.card.gap,
    padding: dueQuiz.card.padding,
    paddingLeft: dueQuiz.card.paddingLeft,
    overflow: 'hidden',
  },
  count: {
    position: 'absolute',
    right: dueQuiz.count.right,
    top: dueQuiz.count.top,
    opacity: dueQuiz.count.opacity,
  },
  text: { flex: 1, gap: dueQuiz.card.textGap },
  progress: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segments: { flexDirection: 'row', gap: dueQuiz.segment.gap },
  segment: {
    width: dueQuiz.segment.width,
    height: dueQuiz.segment.height,
    transform: [{ skewX: dueQuiz.segment.skew }],
  },
  options: { gap: space[2] },
});
