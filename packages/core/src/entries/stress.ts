import type { Word } from '@slovo/contracts';

/** The combining acute accent, drawn over the character it follows. */
const STRESS_MARK = '́';

/**
 * The Lemma as it is shown to the reader: a combining acute accent follows each
 * stressed vowel. Stress positions count the Lemma's characters from zero.
 */
export function renderStress({ lemma, stress }: Pick<Word, 'lemma' | 'stress'>): string {
  const stressed = new Set(stress);
  return Array.from(lemma, (character, position) =>
    stressed.has(position) ? `${character}${STRESS_MARK}` : character,
  ).join('');
}

/**
 * The stressed vowels of the Lemma, in order: one per valid Stress, as
 * VoiceOver names them. Empty in an Edition that doesn't mark Stress.
 */
export function stressedVowelsOf({ lemma, stress }: Pick<Word, 'lemma' | 'stress'>): string[] {
  const characters = Array.from(lemma);
  return stress.flatMap((position) => characters[position] ?? []);
}

/**
 * The text with every Stress mark taken out, such as a Lemma with Stress or a
 * Definition that marks one, for VoiceOver: the voices break a word at the mark.
 */
export function withoutStress(text: string): string {
  return text.replaceAll(STRESS_MARK, '');
}
