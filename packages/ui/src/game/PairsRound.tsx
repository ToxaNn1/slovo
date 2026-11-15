'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round } from '@slovo/core';

import { PairsGrid } from './PairsGrid';

/**
 * A Round of the pairs form: its grid stands under the mode's label in place
 * of the card and the options. A grid that stays (the Round's `stays`, `pairsStay`) is kept from
 * pair to pair, keyed by the grid's first Round: the Round's number less the
 * pairs answered in it.
 */
export function PairsRound({
  round,
  onAnswer,
}: {
  round: Extract<Round, { form: 'pairs' }>;
  onAnswer: (given: Extract<GivenAnswer, { form: 'pairs' }>) => void;
}) {
  const answered = round.words.filter(({ state }) => state !== 'open').length;
  const stay = round.stays;
  return (
    <PairsGrid
      key={stay ? round.number - answered : round.number}
      stay={stay}
      words={round.words}
      definitions={round.definitions}
      answer={round.answer?.form === 'pairs' ? round.answer : undefined}
      onAnswer={(word, definition) => {
        onAnswer({ form: 'pairs', word, definition });
      }}
    />
  );
}
