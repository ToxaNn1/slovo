'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round } from '@slovo/core';

import { PairsGrid } from './PairsGrid';

/**
 * A Round of the pairs form: its grid stands under the mode's label in place
 * of the card and the options.
 */
export function PairsRound({
  round,
  onAnswer,
}: {
  round: Extract<Round, { form: 'pairs' }>;
  onAnswer: (given: Extract<GivenAnswer, { form: 'pairs' }>) => void;
}) {
  return (
    <PairsGrid
      key={round.number}
      words={round.words}
      definitions={round.definitions}
      answer={round.answer?.form === 'pairs' ? round.answer : undefined}
      onAnswer={(word, definition) => {
        onAnswer({ form: 'pairs', word, definition });
      }}
    />
  );
}
