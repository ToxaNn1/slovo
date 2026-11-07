import { CROSSWORD_SIZE } from '@slovo/contracts';

import {
  crossingPlacesOf,
  generateCrossingCrossword,
  type CrossingPuzzle,
  type CrossingWord,
} from './crossing-crossword';
import type { PuzzlePlace } from './crossword-puzzle';
import { seededRandomOf } from './traced-crossword';
import { word } from '../test-support';

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Words of 3–5 letters that can fill a grid, and five that cannot: a phrase, a capital, an apostrophe, two letters, seven. */
export const vocabulary = [
  ...(
    'cat dog sun fox owl bee ant elk yak cow pig rat bat hen ram eel cod gnu emu ape ' +
    'wolf bear deer lion lynx seal crab frog toad swan dove hawk crow wren moth wasp slug newt mole hare boar bull calf foal lamb goat duck ' +
    'tiger zebra camel horse mouse moose otter whale shark eagle robin finch quail stork goose snake gecko viper cobra sheep llama hyena panda koala lemur sloth bison okapi tapir dingo ' +
    'oak elm ash fir yew pine rose lily iris reed moss fern kelp maple birch cedar aspen holly olive lotus poppy tulip daisy'
  )
    .split(' ')
    .map((lemma) => word(`w_${lemma}`)),
  word('w_wide field'),
  word('w_Kyiv'),
  word("w_o'clock"),
  word('w_ar'),
  word('w_rainbow'),
];

export const ineligible = new Set(['wide field', 'Kyiv', "o'clock", 'ar', 'rainbow']);

export function puzzleOf(date: string, words = vocabulary): CrossingPuzzle {
  const generation = generateCrossingCrossword({
    date,
    words,
    alphabet: ALPHABET,
    seeded: seededRandomOf,
  });
  if (generation.kind !== 'puzzle') throw new Error(`Expected a puzzle, got ${generation.kind}`);
  return generation.puzzle;
}

export const key = ({ row, column }: PuzzlePlace) => `${String(row)},${String(column)}`;

/** The grid as rows of `#` (block) and `.` (white). */
export function rowsOf(puzzle: CrossingPuzzle): string[] {
  const blocks = new Set(puzzle.blocks.map(key));
  return Array.from({ length: CROSSWORD_SIZE }, (_, row) =>
    Array.from({ length: CROSSWORD_SIZE }, (_, column) =>
      blocks.has(key({ row, column })) ? '#' : '.',
    ).join(''),
  );
}

/** Every maximal horizontal and vertical run of white cells, with its cells. */
export function runsOf(rows: readonly string[]): PuzzlePlace[][] {
  const runs: PuzzlePlace[][] = [];
  for (const direction of ['across', 'down'] as const) {
    for (let i = 0; i < CROSSWORD_SIZE; i += 1) {
      let run: PuzzlePlace[] = [];
      for (let j = 0; j <= CROSSWORD_SIZE; j += 1) {
        const place = direction === 'across' ? { row: i, column: j } : { row: j, column: i };
        const white = j < CROSSWORD_SIZE && rows[place.row]?.[place.column] === '.';
        if (white) run.push(place);
        else {
          if (run.length > 0) runs.push(run);
          run = [];
        }
      }
    }
  }
  return runs;
}

const placesOf = (words: readonly CrossingWord[], direction: CrossingWord['direction']) =>
  words.filter((w) => w.direction === direction).flatMap((w) => crossingPlacesOf(w).map(key));

/** The cells that belong to one across and one down Word. */
export function crossingsOf(puzzle: CrossingPuzzle): Set<string> {
  const across = new Set(placesOf(puzzle.words, 'across'));
  return new Set(placesOf(puzzle.words, 'down').filter((k) => across.has(k)));
}
