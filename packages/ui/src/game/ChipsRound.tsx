'use no memo';
// Split from the Game Round, whose modules the React Compiler skips.

import type { GivenAnswer, Round } from '@slovo/core';

import { useEdition } from '../providers/EditionProvider';
import { OrderedChips } from './OrderedChips';
import { RoundCard } from './RoundCard';

/**
 * A Round of the chips form: its chips, a Word's letters or an expression's
 * words, stand under the card in place of the options. A Word's letters, as
 * «Анаграми» shows them in a line, take «← Стерти літеру», which takes back
 * the last letter placed, and a wrong Word shows the right one in its line
 * (board 06).
 * An expression's words on the ground take the label as an ink heading and
 * the meaning in grey under it (board 07 g6).
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
  const { strings } = useEdition();
  const letters = round.chipKind === 'letter';
  return (
    <>
      <RoundCard
        label={label}
        prompt={prompt}
        highlight={round.highlight}
        gap={round.gap}
        definition={round.definition}
        face={round.chipKind === 'word' ? { look: 'heading' } : undefined}
      />
      <OrderedChips
        key={round.number}
        chips={round.chips}
        kind={round.chipKind}
        fixed={round.fixed}
        eraseLabel={letters ? strings.game.round.eraseLetter : undefined}
        showsRight={letters}
        answer={round.answer?.form === 'chips' ? round.answer : undefined}
        onAnswer={(chips) => {
          onAnswer({ form: 'chips', chips });
        }}
      />
    </>
  );
}
