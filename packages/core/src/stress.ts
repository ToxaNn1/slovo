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
