import type { LanguageTraits } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { STRESS_MARK } from '../entries/stress';

/**
 * What a text is compared for: a typed answer against a Round's right answer
 * (Game), a Search query against an Entry's text, or a Definition or an option
 * against another (Distractors).
 */
export type ComparisonPurpose = 'typedAnswer' | 'searchQuery' | 'definition';

/** The Edition traits text is compared by. */
export type TextComparisonEdition = Pick<Edition, 'searchLetters'> & {
  readonly languageTraits: Pick<LanguageTraits, 'apostrophes' | 'sortLocale'>;
};

/** How the Edition compares text: the Comparison Key of a text for each purpose. */
export interface TextComparison {
  /** The Comparison Key of the text for the purpose. */
  key(text: string, purpose: ComparisonPurpose): string;
  /** Whether two texts have the same Comparison Key for the purpose. */
  same(one: string, other: string, purpose: ComparisonPurpose): boolean;
  /** The apostrophe a Comparison Key writes for each the Edition reads as one; none in an Edition that lists none. */
  readonly apostrophe: string | undefined;
}

/**
 * The Edition's text comparison. Every Comparison Key folds case with the
 * Edition's locale, takes out Stress marks, writes each of the Edition's
 * apostrophes as its first and drops spaces at the ends. Letters stay
 * distinct otherwise, so г and ґ, е and ё never match: decomposing first
 * takes out a Stress mark typed over a precomposed letter and keeps the
 * diaeresis of ё. A Search query also reads the Edition's Search letters as
 * the ones they map to (ADR 0054), since a reader looking a word up
 * shouldn't have to know its spelling; a Definition or option reads every run
 * of spaces inside it as one.
 */
export function createTextComparison({
  languageTraits: { apostrophes = [], sortLocale },
  searchLetters,
}: TextComparisonEdition): TextComparison {
  const [apostrophe] = apostrophes;
  const readAsApostrophe = new Set(apostrophes);
  const typedAnswer = (text: string) =>
    Array.from(
      text
        .normalize('NFD')
        .replaceAll(STRESS_MARK, '')
        .normalize('NFC')
        .toLocaleLowerCase(sortLocale),
      (character) =>
        apostrophe !== undefined && readAsApostrophe.has(character) ? apostrophe : character,
    )
      .join('')
      .trim();
  const keyFor: Readonly<Record<ComparisonPurpose, (text: string) => string>> = {
    typedAnswer,
    searchQuery: (text) =>
      Array.from(typedAnswer(text), (letter) => searchLetters[letter] ?? letter).join(''),
    definition: (text) => typedAnswer(text).replace(/\s+/g, ' '),
  };
  return {
    key: (text, purpose) => keyFor[purpose](text),
    same: (one, other, purpose) => keyFor[purpose](one) === keyFor[purpose](other),
    apostrophe,
  };
}
