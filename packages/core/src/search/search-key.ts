import { typedAnswerKey } from '../game/typed-answer';

/**
 * The letters Search reads as another, from the Edition: each lower-case
 * letter maps to the one it reads as (ґ → г and ё → е in the Ukrainian
 * Edition, ADR 0054).
 */
export type SearchLetters = Readonly<Record<string, string>>;

/**
 * The text as Search compares it: the typed-answer comparison (case, Stress
 * marks, the kind of apostrophe, spaces at the ends), with the Edition's
 * Search letters read alike on top, since a reader looking a word up
 * shouldn't have to know its spelling. The Game stays strict on those letters.
 */
export function searchKey(text: string, letters: SearchLetters): string {
  return Array.from(typedAnswerKey(text), (letter) => letters[letter] ?? letter).join('');
}
