'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round } from '@slovo/core';

import { useEdition } from '../providers/EditionProvider';
import { letterLabel } from './letter-label';
import { RoundCard } from './RoundCard';
import { VowelButtons } from './VowelButtons';

/**
 * A Round of the vowel form: its Word stands in the card with each vowel a
 * button, which VoiceOver reads by its place among the letters.
 */
export function VowelRound({
  round,
  label,
  prompt,
  onAnswer,
}: {
  round: Extract<Round, { form: 'vowel' }>;
  /** The label VoiceOver reads before the vowel buttons. */
  label: string;
  prompt: string;
  onAnswer: (given: Extract<GivenAnswer, { form: 'vowel' }>) => void;
}) {
  const { strings } = useEdition();
  return (
    <RoundCard label={label} prompt={prompt} highlight={undefined} gap={undefined}>
      <VowelButtons
        key={round.number}
        text={round.prompt}
        vowels={round.vowels}
        answer={round.answer?.form === 'vowel' ? round.answer : undefined}
        onAnswer={(position) => {
          onAnswer({ form: 'vowel', position });
        }}
        texts={{
          vowelLabel: (letter, place) => letterLabel(strings.game.letters, letter, place),
          correct: strings.game.round.correct,
          chosen: strings.game.round.chosen,
        }}
        testID="game-vowels"
      />
    </RoundCard>
  );
}
