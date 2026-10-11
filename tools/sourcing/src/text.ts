/** The combining acute accent that dictionaries put after a stressed vowel. */
const STRESS_MARK = '́';

const APOSTROPHES = /[’ʼ`]/g;

/** Collapses runs of whitespace (including no-break spaces) into one space. */
export function squeeze(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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

/** The form two spellings of a Lemma are compared in: unmarked, lowercase, one apostrophe. */
export function matchKey(text: string): string {
  return squeeze(unstressed(text)).toLocaleLowerCase('uk').replace(APOSTROPHES, "'");
}
