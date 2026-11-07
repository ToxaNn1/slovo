import { renderStress, stressedVowelsOf } from '../entries/stress';
import { outOfOrder, type FixedChip } from './chips-form';
import type { AnswerSheet, GameMode, RoundContent } from './game-mode';
import type { Random } from '../ports';
import { shuffled } from '../shuffled';

/** The characters of a Word that stay in place and are never blanks: an apostrophe of any kind or a hyphen. */
const IN_PLACE = new Set(["'", 'ʼ', '’', '-']);

/** Whether a character of a Word stays in place among its blanks: an apostrophe of any kind or a hyphen. */
const staysInPlace = (character: string): boolean => IN_PLACE.has(character);

/** How many letter tiles a Round shows at least, and the columns they stand in, which their count fills. */
const TILES = { min: 8, columns: 4 } as const;

/**
 * The letter tiles of a Word: its letters plus decoys, letters of the
 * alphabet not in the Word, as many as make at least 8 tiles, rounded up to
 * a multiple of 4; all shuffled by the port, never in the Word's order.
 */
function tilesOf(
  letters: readonly string[],
  alphabet: readonly string[],
  random: Random,
): readonly string[] {
  const count = Math.max(TILES.min, Math.ceil(letters.length / TILES.columns) * TILES.columns);
  const inWord = new Set(letters.map((letter) => letter.toLowerCase()));
  const decoys = shuffled(
    alphabet.filter((letter) => !inWord.has(letter)),
    random,
  ).slice(0, count - letters.length);
  return outOfOrder(letters, shuffled([...letters, ...decoys], random));
}

/** A Round of letter tiles: the Word's letters and decoys, tapped into a slot for each letter. */
function tilesRound(
  { lemma, prompt, sheet }: { lemma: string; prompt: string; sheet: AnswerSheet },
  alphabet: readonly string[],
  random: Random,
): RoundContent {
  const letters: string[] = [];
  const fixed: FixedChip[] = [];
  for (const character of lemma) {
    if (staysInPlace(character)) fixed.push({ at: letters.length, text: character });
    else letters.push(character);
  }
  return {
    form: 'chips',
    chipKind: 'letter',
    layout: 'tiles',
    prompt,
    chips: tilesOf(letters, alphabet, random),
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
 * letter and the reader types the Word, compared the way
 * `typedAnswerMatches` does; «Відкрити літеру» opens one letter at a time
 * until one is left, at no cost. An apostrophe or a hyphen stays in place
 * and is no tile or blank; a Word with a space never plays. Its sheet shows
 * the Lemma with its Stress and its first Example, if it has one.
 */
export const byLettersMode: GameMode = {
  id: 'by-letters',
  group: 'words',
  entryKind: 'word',
  isOn: (edition) => edition.isFeatureEnabled('gameByLetters'),
  buildRound({ answer, edition, random }) {
    if (answer.kind !== 'word' || answer.lemma.includes(' ')) return undefined;
    const sheet = {
      answer: { text: renderStress(answer), stressedVowels: stressedVowelsOf(answer) },
      example: answer.examples[0],
    };
    if (edition.isFeatureEnabled('letterTiles')) {
      const prompt = answer.primaryDefinition;
      const alphabet = edition.languageTraits.alphabet ?? [];
      return tilesRound({ lemma: answer.lemma, prompt, sheet }, alphabet, random);
    }
    const inPlace = Array.from(answer.lemma).flatMap((character, place) =>
      staysInPlace(character) ? [place] : [],
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
