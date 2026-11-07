'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round } from '@slovo/core';

import { Text } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { roundLayout, typeStyle } from '../tokens';
import { letterLabel } from './letter-label';
import { RoundCard } from './RoundCard';
import { VowelButtons } from './VowelButtons';

/**
 * A Round of the vowel form: its Word stands in the card with each vowel a
 * button, which VoiceOver reads by its place among the letters. The
 * Edition's hint stands under the card, e.g. «Торкнись голосної, на яку
 * падає наголос».
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
  const { strings, voice } = useEdition();
  const tokens = useTokens();
  return (
    <>
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
      <Text
        testID="game-stress-hint"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle('roundExplanation', tokens), { color: tokens.colors.muted }]}
      >
        {strings.game.round.stressHint}
      </Text>
    </>
  );
}
