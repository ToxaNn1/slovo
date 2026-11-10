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

/** A stretch of a text, from its first character to the one after its last, in UTF-16 places. */
export interface FoundRange {
  readonly start: number;
  readonly end: number;
}

/** How the Edition compares text: the Comparison Key of a text for each purpose. */
export interface TextComparison {
  /** The Comparison Key of the text for the purpose. */
  key(text: string, purpose: ComparisonPurpose): string;
  /** Whether two texts have the same Comparison Key for the purpose. */
  same(one: string, other: string, purpose: ComparisonPurpose): boolean;
  /**
   * Where the text first holds the sought text by the rules every Comparison
   * Key shares (case, Stress marks, apostrophes), as written in the text, the
   * Stress marks after its last letter included; with `wholeWord`, only where
   * no letter, mark, digit, hyphen or apostrophe of the Edition stands next to
   * it. Nothing when it holds none, or the sought text is empty. Both texts
   * are taken as written in one Unicode form.
   */
  find(
    text: string,
    sought: string,
    options?: { readonly wholeWord?: boolean },
  ): FoundRange | undefined;
  /** Whether the Edition reads the character as an apostrophe. */
  isApostrophe(character: string): boolean;
  /** The text in lower case, by the Edition's locale, as every Comparison Key folds it. */
  lowerCase(text: string): string;
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
  const isApostrophe = (character: string) => readAsApostrophe.has(character);
  const lowerCase = (text: string) => text.toLocaleLowerCase(sortLocale);
  const withApostrophe = (text: string) =>
    Array.from(text, (character) =>
      apostrophe !== undefined && isApostrophe(character) ? apostrophe : character,
    ).join('');
  /** The text as every Comparison Key writes it, before its ends are dropped. */
  const keyed = (text: string) =>
    withApostrophe(
      lowerCase(text.normalize('NFD').replaceAll(STRESS_MARK, '').normalize('NFC')),
    );
  const typedAnswer = (text: string) => keyed(text).trim();
  const isWordCharacter = (character: string) =>
    /[\p{L}\p{M}\p{N}-]/u.test(character) || isApostrophe(character);
  function find(
    text: string,
    sought: string,
    { wholeWord = false }: { readonly wholeWord?: boolean } = {},
  ): FoundRange | undefined {
    const wanted = keyed(sought);
    if (wanted === '') return undefined;
    let plain = '';
    /** The place in the text of each place in `plain` that begins a character's keyed form. */
    const placeAt = new Map<number, number>();
    let place = 0;
    for (const character of text) {
      const form = keyed(character);
      if (form !== '' && !placeAt.has(plain.length)) placeAt.set(plain.length, place);
      plain += form;
      place += character.length;
    }
    /** The place in the text where the character after `plain`'s place stands, past Stress marks; the end of the text when none. */
    const endAt = (at: number) =>
      placeAt.get(at) ?? (at === plain.length ? text.length : undefined);
    for (let at = plain.indexOf(wanted); at >= 0; at = plain.indexOf(wanted, at + 1)) {
      const start = placeAt.get(at);
      const end = endAt(at + wanted.length);
      if (start === undefined || end === undefined) continue;
      if (
        wholeWord &&
        (isWordCharacter(text.charAt(start - 1)) || isWordCharacter(text.charAt(end)))
      )
        continue;
      return { start, end };
    }
    return undefined;
  }
  const keyFor: Readonly<Record<ComparisonPurpose, (text: string) => string>> = {
    typedAnswer,
    searchQuery: (text) =>
      Array.from(typedAnswer(text), (letter) => searchLetters[letter] ?? letter).join(''),
    definition: (text) => typedAnswer(text).replace(/\s+/g, ' '),
  };
  return {
    key: (text, purpose) => keyFor[purpose](text),
    same: (one, other, purpose) => keyFor[purpose](one) === keyFor[purpose](other),
    find,
    isApostrophe,
    lowerCase,
    apostrophe,
  };
}
