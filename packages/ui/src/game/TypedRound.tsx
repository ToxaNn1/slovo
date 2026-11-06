'use no memo';
// Split from the Game Round, whose modules the React Compiler skips (ADR 0059).

import type { GivenAnswer, Round, RoundBlank } from '@slovo/core';
import { useState } from 'react';
import { Keyboard } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { letterLabel } from './letter-label';
import { RoundCard } from './RoundCard';
import { TypedAnswer } from './TypedAnswer';

/**
 * A Round of the typed form: its field stands under the card in place of the
 * options, with the Word's blanks and «Відкрити літеру» in a Round that shows
 * blanks.
 */
export function TypedRound({
  round,
  label,
  prompt,
  onAnswer,
  onOpenLetter,
}: {
  round: Extract<Round, { form: 'typed' }>;
  /** The label the card reads over the prompt. */
  label: string;
  prompt: string;
  onAnswer: (given: Extract<GivenAnswer, { form: 'typed' }>) => void;
  /** «Відкрити літеру» in a Round with blanks. */
  onOpenLetter: () => void;
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
      <TypedRoundAnswer
        key={round.number}
        blanks={round.blanks}
        onAnswer={(text) => {
          onAnswer({ form: 'typed', text });
        }}
        onOpenLetter={onOpenLetter}
      />
    </>
  );
}

/**
 * A typed Round's answer under its card: the Word's blanks, if the Round
 * shows them, with «Відкрити літеру», and the field, which keeps what the
 * reader typed until the Round is answered. VoiceOver reads each blank by its
 * place among the letters. The keyboard goes as the answer is given, so the
 * sheet shows whole.
 */
function TypedRoundAnswer({
  blanks,
  onAnswer,
  onOpenLetter,
}: {
  /** The Word's blanks, as the Core opens them; none in a Round that shows none. */
  blanks: readonly RoundBlank[] | undefined;
  onAnswer: (text: string) => void;
  onOpenLetter: () => void;
}) {
  const { strings } = useEdition();
  const { letters, openLetter, round } = strings.game;
  const [text, setText] = useState('');
  return (
    <TypedAnswer
      value={text}
      onChangeText={setText}
      onSubmit={() => {
        Keyboard.dismiss();
        onAnswer(text);
      }}
      blanks={blanks}
      onOpenLetter={blanks === undefined ? undefined : onOpenLetter}
      texts={{
        label: round.typed.label,
        submit: round.typed.submit,
        openLetter,
        blankLabel: (place, letter) =>
          letter === undefined
            ? fill(letters.empty, { place: letters.ordinals[place] ?? String(place + 1) })
            : letterLabel(letters, letter, place),
      }}
      testID="game-typed"
    />
  );
}
