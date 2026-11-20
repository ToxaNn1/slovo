import type { AnswerSheet as RoundSheet, AskableEntry, RoundAnswer } from '@slovo/core';
import { useState } from 'react';

import { BottomSheet } from '../primitives/BottomSheet';
import { AnswerCard } from './AnswerCard';

/**
 * The answer card's line: the sheet's explanation, such as a Correction's,
 * else the primary Definition of the Entry the Round asked about, if it has one.
 */
export function cardLine(sheet: RoundSheet, entry: AskableEntry | undefined): string | undefined {
  if (sheet.explanation !== undefined) return sheet.explanation;
  return entry !== undefined && 'primaryDefinition' in entry ? entry.primaryDefinition : undefined;
}

/**
 * The sheet after an answer: the answer card (board 07, spec #1674) on red
 * with ink on it for a right answer and on the Theme's ink for a wrong one,
 * so the explanation stays in sight however long the Round, and the sheet
 * stands apart from the Round under it, which no scrim dims. «Далі →» is the
 * only way to close it. It keeps what it showed while it slides away.
 */
export function AnswerSheet({
  answer,
  line,
  onNext,
}: {
  answer: RoundAnswer | undefined;
  /** The answer card's line for this answer. */
  line: string | undefined;
  onNext: () => void;
}) {
  // The answer it shows and its line, kept while the sheet leaves after «Далі» took the Round's away,
  // and how many it has shown: each answer gets a card of its own, which VoiceOver hears.
  const [shown, setShown] = useState(answer === undefined ? undefined : { answer, line, count: 0 });
  if (answer !== undefined && answer !== shown?.answer)
    setShown({ answer, line, count: (shown?.count ?? -1) + 1 });
  return (
    <BottomSheet
      visible={answer !== undefined}
      tone={shown?.answer.right === true ? 'accent' : 'ink'}
      testID="game-sheet"
    >
      {shown === undefined ? null : (
        <AnswerCard
          key={shown.count}
          right={shown.answer.right}
          line={shown.line}
          onNext={onNext}
        />
      )}
    </BottomSheet>
  );
}
