import { STRESS_MARK, type Word } from '@slovo/contracts';

export { renderStress, STRESS_MARK } from '@slovo/contracts';

/**
 * The stressed vowels of the Lemma, in order: one per valid Stress, as
 * VoiceOver names them. Empty in an Edition that doesn't mark Stress.
 */
export function stressedVowelsOf({ lemma, stress }: Pick<Word, 'lemma' | 'stress'>): string[] {
  const characters = Array.from(lemma);
  return stress.flatMap((position) => characters[position] ?? []);
}

/**
 * The stressed vowels of a text that writes its Stress, such as a stress
 * trap's form (ADR 0045), in order: each character a Stress mark follows.
 * Empty for a text without marks.
 */
export function markedStressedVowelsOf(text: string): string[] {
  const characters = Array.from(text);
  return characters.filter((_, position) => characters[position + 1] === STRESS_MARK);
}

/**
 * The text with every Stress mark taken out, such as a Lemma with Stress or a
 * Definition that marks one, for VoiceOver: the voices break a word at the mark.
 */
export function withoutStress(text: string): string {
  return text.replaceAll(STRESS_MARK, '');
}
