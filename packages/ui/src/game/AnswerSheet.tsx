import {
  stressLabel,
  type AnswerSheet as RoundSheet,
  type AskableEntry,
  type RoundAnswer,
} from '@slovo/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { roundLayout, space, typeStyle } from '../tokens';
import { AnswerCard, NextButton, VerdictTitle } from './AnswerCard';

/**
 * The answer card's line: the sheet's explanation, such as a Correction's,
 * else the primary Definition of the Entry the Round asked about, if it has one.
 */
export function cardLine(sheet: RoundSheet, entry: AskableEntry | undefined): string | undefined {
  if (sheet.explanation !== undefined) return sheet.explanation;
  return entry !== undefined && 'primaryDefinition' in entry ? entry.primaryDefinition : undefined;
}

/**
 * The sheet after an answer (`game-round-correct-dark`,
 * `game-round-wrong-dark`, `game-round-correction-answered-light`):
 * «Правильно!» or «Не цього разу», the right answer with its Stress and its
 * Example with the author, or its explanation, or the answer alone, and
 * «Далі», the only way to close it. As the boards draw it, a right answer is
 * on red with ink on it and a wrong one on the Theme's ink. With the answer
 * card switched on (`gameAnswerCard`) it shows the answer card instead, on
 * the same red or ink, so the explanation stays in sight however long the
 * Round, and the sheet stands apart from the Round under it, which no scrim
 * dims. It keeps what it showed while it slides away.
 */
export function AnswerSheet({
  answer,
  line,
  feedback,
  onNext,
}: {
  answer: RoundAnswer | undefined;
  /** The answer card's line for this answer. */
  line: string | undefined;
  feedback: 'sheet' | 'card';
  onNext: () => void;
}) {
  // The answer it shows and its line, kept while the sheet leaves after «Далі» took the Round's away.
  const [shown, setShown] = useState(answer === undefined ? undefined : { answer, line });
  if (answer !== undefined && answer !== shown?.answer) setShown({ answer, line });
  return (
    <BottomSheet
      visible={answer !== undefined}
      tone={shown?.answer.right === true ? 'accent' : 'ink'}
      testID="game-sheet"
    >
      {shown === undefined ? null : feedback === 'card' ? (
        <AnswerCard right={shown.answer.right} line={shown.line} onNext={onNext} />
      ) : (
        <AnswerSheetContent answer={shown.answer} onNext={onNext} />
      )}
    </BottomSheet>
  );
}

function AnswerSheetContent({ answer, onNext }: { answer: RoundAnswer; onNext: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { right } = answer;
  const { example, explanation } = answer.sheet;
  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
      <VerdictTitle
        testID="game-sheet-title"
        typeRole="roundVerdict"
        text={right ? strings.game.sheet.correct : strings.game.sheet.wrong}
      />
      <WholeWordsText
        text={answer.sheet.answer.text}
        typeRole="roundAnswer"
        accessibilityLabel={stressLabel(
          strings.wordCard,
          answer.sheet.answer.text,
          answer.sheet.answer.stressedVowels,
        )}
        {...voice}
        style={[typeStyle('roundAnswer', tokens), { color: colors.ink }]}
      />
      {example === undefined ? null : (
        <View accessible {...voice}>
          <Text
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            style={[typeStyle('example', tokens), styles.example, { color: colors.ink }]}
          >
            {fill(strings.wordCard.example, { text: example.text })}
          </Text>
          {example.author === undefined ? null : (
            <Text
              maxFontSizeMultiplier={roundLayout.textMaxFontScale}
              style={[typeStyle('meta', tokens), styles.author, { color: colors.muted }]}
            >
              {fill(strings.wordCard.exampleAuthor, { author: example.author })}
            </Text>
          )}
        </View>
      )}
      {explanation === undefined ? null : (
        <Text
          testID="game-sheet-explanation"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundExplanation', tokens), { color: colors.ink }]}
        >
          {explanation}
        </Text>
      )}
      <NextButton label={strings.game.sheet.next} right={right} onPress={onNext} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  // The board's banner title sits clear of the slant over the sheet, not on its low edge.
  sheetContent: { gap: roundLayout.sheetGap, paddingHorizontal: space[1], paddingBottom: space[2] },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1] },
});
