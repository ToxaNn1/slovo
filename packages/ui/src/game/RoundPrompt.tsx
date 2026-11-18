import type { EditionStrings } from '@slovo/contracts';
import type { Round, RoundContent, TextRange } from '@slovo/core';
import { Text } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { roundLayout, typeStyle } from '../tokens';
import type { RoundFace } from './RoundCard';

/**
 * The label and the prompt a Round shows by its label kind: a Synonym Row's
 * question on its dominant, a Tip's own question under the Tip's label, an
 * Example with a gap under the gap's label, an Entry's own text asked by its
 * meaning as «{word}» — це…, any other Round's prompt under the mode's label.
 */
export function askedAs(
  { labelKind = 'mode', prompt }: Pick<RoundContent, 'labelKind' | 'prompt'>,
  label: string,
  strings: EditionStrings['game']['round'],
): { label: string; prompt: string } {
  switch (labelKind) {
    case 'synonymRow':
      return {
        label: strings.synonymRow.label,
        prompt: fill(strings.synonymRow.prompt, { dominant: prompt }),
      };
    case 'tip':
      return { label: strings.tip.label, prompt };
    case 'gap':
      return { label: strings.gap.label, prompt };
    case 'meaning':
      return { label, prompt: fill(strings.prompts.meaning, { word: prompt }) };
    case 'mode':
      return { label, prompt };
  }
}

/** What a Round's card shows: its prompt, the part of it to mark and its restyled look. */
export interface CardText {
  readonly prompt: string;
  readonly highlight: TextRange | undefined;
  readonly face: RoundFace | undefined;
}

/**
 * The card a Round shows by its Game Mode (board 07 g3, g4, spec #1674):
 * «Впиши слово» names the wrong form over its sentence, «замість «вірогідно»»;
 * «Англіцизм» shows the sentence alone, the anglicism in red (board g5); «Звідки слово» shows its Word on a
 * sunken tile. Any other Round shows its prompt as it is.
 */
export function cardOf(
  modeId: string,
  round: Round,
  prompt: string,
  prompts: { readonly instead: string },
): CardText {
  const highlight = round.form === 'pick' || round.form === 'typed' ? round.highlight : undefined;
  const plain = { prompt, highlight, face: undefined };
  if (modeId === 'origin' && round.form === 'pick') {
    return { prompt, highlight: undefined, face: { look: 'word' } };
  }
  if (highlight === undefined) return plain;
  const marked = prompt.slice(highlight.start, highlight.end);
  if (modeId === 'type-word' && round.form === 'typed') {
    return {
      prompt,
      highlight,
      face: { look: 'instead', instead: fill(prompts.instead, { wrong: marked }) },
    };
  }
  if (modeId === 'anglicism' && round.form === 'pick') {
    return { prompt, highlight, face: { look: 'redMark' } };
  }
  return plain;
}

/**
 * The Round's head (`game-round-dark`, board 07): its label and place, such
 * as «ВИЗНАЧЕННЯ · 3 / 15», in the red Unbounded, broken only between whole
 * words. The label is the Round's heading for VoiceOver where its card does
 * not read it, a vowel or a pairs Round; the place is the header's to read.
 */
export function RoundHead({
  label,
  heading,
  testID,
}: {
  label: string;
  /** Whether VoiceOver reads the label as the Round's heading; else the card reads it. */
  heading: boolean;
  testID: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <Text
      testID={testID}
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...(heading
        ? { accessibilityRole: 'header', accessibilityLabel: label }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no' })}
      {...voice}
      style={[typeStyle('roundHead', tokens), { color: colors.accentText }]}
    >
      {label}
    </Text>
  );
}
