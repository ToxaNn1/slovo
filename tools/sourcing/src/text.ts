/** The combining acute accent that dictionaries put after a stressed vowel. */
const STRESS_MARK = '́';

const APOSTROPHES = /[’ʼ`]/g;

/**
 * Collapses runs of whitespace (including no-break spaces) into one space, and
 * writes the Latin look-alikes the dictionaries put into Cyrillic words, such
 * as the "i" in `вiд`, as the Cyrillic letters they stand for.
 */
export function squeeze(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\p{L}\p{M}]+/gu, inCyrillic);
}

const CYRILLIC_LOOK_ALIKES: Readonly<Record<string, string>> = {
  a: 'а',
  c: 'с',
  e: 'е',
  i: 'і',
  o: 'о',
  p: 'р',
  x: 'х',
  y: 'у',
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  I: 'І',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
};

/** A word mostly in Cyrillic, its Latin letters all look-alikes, in Cyrillic; any other word as it is. */
function inCyrillic(word: string): string {
  const latin = word.match(/\p{Script=Latin}/gu) ?? [];
  const cyrillic = word.match(/\p{Script=Cyrillic}/gu) ?? [];
  if (latin.length === 0 || cyrillic.length <= latin.length) return word;
  if (!latin.every((letter) => letter in CYRILLIC_LOOK_ALIKES)) return word;
  return word.replace(/\p{Script=Latin}/gu, (letter) => CYRILLIC_LOOK_ALIKES[letter] ?? letter);
}

/** Drops stress marks from dictionary text. */
export function unstressed(text: string): string {
  return text.replaceAll(STRESS_MARK, '');
}

/**
 * Reads the Stress of a word written with stress marks: the zero-based
 * positions of the marked letters within the unmarked word.
 */
export function readStress(marked: string): number[] {
  const positions: number[] = [];
  let index = 0;
  for (const character of squeeze(marked)) {
    if (character === STRESS_MARK) positions.push(index - 1);
    else index += 1;
  }
  return positions;
}

/**
 * The language of every dictionary the tool reads (goroh.pp.ua, СУМ, ЕСУМ),
 * as a BCP 47 language subtag. Their text is cased by its rules, and only an
 * Edition in this language can be sourced from them.
 */
export const SOURCE_LANGUAGE = 'uk';

/** The form two spellings of a Lemma are compared in: unmarked, lowercase, one apostrophe. */
export function matchKey(text: string): string {
  return squeeze(unstressed(text)).toLocaleLowerCase(SOURCE_LANGUAGE).replace(APOSTROPHES, "'");
}
