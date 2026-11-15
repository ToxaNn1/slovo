'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round } from '@slovo/core';

import { useEdition } from '../providers/EditionProvider';
import { OrderedChips } from './OrderedChips';
import { RoundCard } from './RoundCard';
import { useRoundLook } from './round-look';

/**
 * A Round of the chips form: its chips, a Word's letters or an expression's
 * words, stand under the card in place of the options. A Word's letters in
 * a line, as «Анаграми» shows them, take «← Стерти літеру», which takes back
 * the last letter placed, and a wrong Word shows the right one in its line
 * (board 06); letter tiles take a letter back at a tap on its slot.
 * An expression's words on the ground take the label as an ink heading and
 * the meaning in grey under it (board 07 g6); in the assembly field the
 * check key, «Перевірити», gives the answer.
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
  const { onGround } = useRoundLook();
  const lettersInLine = round.chipKind === 'letter' && round.layout === 'line';
  return (
    <>
      <RoundCard
        label={label}
        prompt={prompt}
        highlight={round.highlight}
        gap={round.gap}
        definition={round.definition}
        face={onGround && round.chipKind === 'word' ? { look: 'heading' } : undefined}
      />
      <OrderedChips
        key={round.number}
        chips={round.chips}
        kind={round.chipKind}
        fixed={round.fixed}
        layout={round.layout}
        slots={round.slots}
        eraseLabel={lettersInLine ? strings.game.round.eraseLetter : undefined}
        showsRight={lettersInLine}
        checkLabel={round.layout === 'field' ? strings.game.dailyCrossword.check : undefined}
        answer={round.answer?.form === 'chips' ? round.answer : undefined}
        onAnswer={(chips) => {
          onAnswer({ form: 'chips', chips });
        }}
      />
    </>
  );
}
