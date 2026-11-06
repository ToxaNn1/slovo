'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round } from '@slovo/core';

import { OrderedChips } from './OrderedChips';
import { RoundCard } from './RoundCard';

/**
 * A Round of the chips form: its chips, a Word's letters or an expression's
 * words, stand under the card in place of the options.
 */
export function ChipsRound({
  round,
  label,
  prompt,
  onAnswer,
}: {
  round: Extract<Round, { form: 'chips' }>;
  /** The label the card reads over the prompt. */
  label: string;
  prompt: string;
  onAnswer: (given: Extract<GivenAnswer, { form: 'chips' }>) => void;
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
      <OrderedChips
        key={round.number}
        chips={round.chips}
        kind={round.chipKind}
        fixed={round.fixed}
        answer={round.answer?.form === 'chips' ? round.answer : undefined}
        onAnswer={(chips) => {
          onAnswer({ form: 'chips', chips });
        }}
      />
    </>
  );
}
