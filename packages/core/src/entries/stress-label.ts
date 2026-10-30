import { fill, type EditionStrings } from '@slovo/contracts';
import { withoutStress } from './stress';

/**
 * What VoiceOver reads for text with Stress, such as a Lemma or a stress
 * trap's form: the text without its Stress marks, which break a word in the
 * voices, then where the Stress falls («наголос на а»). The text alone when it
 * has no stressed vowel.
 */
export function stressLabel(
  { stress, stressOr }: Pick<EditionStrings['wordCard'], 'stress' | 'stressOr'>,
  text: string,
  stressedVowels: readonly string[],
): string {
  const spoken = withoutStress(text);
  return stressedVowels.length === 0
    ? spoken
    : `${spoken}, ${fill(stress, { vowels: stressedVowels.join(` ${stressOr} `) })}`;
}
