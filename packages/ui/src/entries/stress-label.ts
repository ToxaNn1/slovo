import { fill, type EditionStrings } from '@slovo/contracts';

/**
 * What VoiceOver reads for text with Stress, such as a Lemma: the text, then
 * where the Stress falls («наголос на а»), since the voices skip the mark.
 * The text alone when it has no stressed vowel.
 */
export function stressLabel(
  { stress, stressOr }: Pick<EditionStrings['wordCard'], 'stress' | 'stressOr'>,
  text: string,
  stressedVowels: readonly string[],
): string {
  return stressedVowels.length === 0
    ? text
    : `${text}, ${fill(stress, { vowels: stressedVowels.join(` ${stressOr} `) })}`;
}
