import { renderStress, stressedVowelsOf } from '../entries/stress';
import { outOfOrder, type FixedChip } from './chips-form';
import type { AnswerSheet, GameMode, RoundContent } from './game-mode';
import type { Random } from '../ports';
import { shuffled } from '../shuffled';
import type { TextComparison } from '../text/text-comparison';

/** Whether a character of a Word stays in place, never a tile or blank: one the Edition reads as an apostrophe, or a hyphen. */
const staysInPlace = (character: string, comparison: TextComparison): boolean =>
  character === '-' || comparison.isApostrophe(character);

/** How many letter tiles a Round shows at least, and the columns they stand in, which their count fills. */
const TILES = { min: 8, columns: 4 } as const;

/**
 * The letter tiles of a Word, in lower case by the Edition's locale: its letters plus decoys, letters
 * of the alphabet not in the Word, as many as make at least 8 tiles, rounded
 * up to a multiple of 4, so none for a Word of 8 or 12 letters; all shuffled
 * by the port, the first tiles never spelling the Word in its order. None
 * when the alphabet has too few letters outside the Word to fill them.
 */
function tilesOf(
  letters: readonly string[],
  alphabet: readonly string[],
  random: Random,
  comparison: TextComparison,
): readonly string[] | undefined {
  const count = Math.max(TILES.min, Math.ceil(letters.length / TILES.columns) * TILES.columns);
  const others = alphabet.filter((letter) => !letters.includes(letter));
  if (others.length < count - letters.length) return undefined;
  const decoys = shuffled(others, random).slice(0, count - letters.length);
  return outOfOrder(letters, shuffled([...letters, ...decoys], random), comparison);
}

/**
 * A Round of letter tiles: the Word's letters in lower case and decoys, tapped
 * into a slot for each letter. None for a Word the alphabet cannot fill the tiles of.
 */
function tilesRound(
  { lemma, prompt, sheet }: { lemma: string; prompt: string; sheet: AnswerSheet },
  alphabet: readonly string[],
  random: Random,
  comparison: TextComparison,
): RoundContent | undefined {
  const letters: string[] = [];
  const fixed: FixedChip[] = [];
  for (const character of lemma) {
    if (staysInPlace(character, comparison)) fixed.push({ at: letters.length, text: character });
    else letters.push(comparison.lowerCase(character));
  }
  const chips = tilesOf(letters, alphabet, random, comparison);
  if (chips === undefined) return undefined;
  return {
    form: 'chips',
    chipKind: 'letter',
    layout: 'tiles',
    prompt,
    chips,
    expected: letters,
    fixed,
    sheet,
  };
}

/**
 * «За буквами», the Core's letters mode (ADR 0052): a Round shows a Word's
 * primary Definition. With `letterTiles` on (board 07), the reader taps
 * letter tiles, the Word's letters plus decoys from the Edition's alphabet,
 * into a red slot for each letter. With it off, a blank stands for each
 * letter and the reader types the Word, compared by its Comparison Key as a
 * typed answer; «Відкрити літеру» opens one letter at a time until one is
 * left, at no cost. A character the Edition reads as an apostrophe, or a
 * hyphen, stays in place and is no tile or blank; a Word with a space never plays, nor, with tiles,
 * one the alphabet has too few decoys for. Its sheet shows
 * the Lemma with its Stress and its first Example, if it has one.
 */
export const byLettersMode: GameMode = {
  id: 'by-letters',
  group: 'words',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gameByLetters'),
  buildRound({ answer, edition, random, comparison }) {
    if (answer.kind !== 'word' || answer.lemma.includes(' ')) return undefined;
    const sheet = {
      answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
      example: answer.examples[0],
    };
    if (edition.isFeatureEnabled('letterTiles')) {
      const prompt = answer.primaryDefinition;
      const { alphabet } = edition.languageTraits;
      return tilesRound({ lemma: answer.lemma, prompt, sheet }, alphabet, random, comparison);
    }
    const inPlace = Array.from(answer.lemma).flatMap((character, place) =>
      staysInPlace(character, comparison) ? [place] : [],
    );
    return {
      form: 'typed',
      prompt: answer.primaryDefinition,
      expected: answer.lemma,
      blanks: { inPlace },
      sheet,
    };
  },
};
