import { createHash } from 'node:crypto';

import {
  CROSSWORD_SIZE,
  CROSSWORD_WORDS,
  CrosswordDaySchema,
  CrosswordWordSchema,
  type CrosswordDay,
  type CrosswordWord,
} from '@slovo/contracts';
import { withoutStress } from '@slovo/core';

import type { BuildError } from './build-error';
import type { PackContent } from './pack-layout';
import { readEdition } from './read-edition';

export type CrosswordResult =
  | { readonly ok: true; readonly day: CrosswordDay }
  | { readonly ok: false; readonly errors: readonly BuildError[] };

/**
 * How many placements one day's search tries before it settles for the
 * fullest grid found, so a thin word supply never makes the build hang.
 */
const SEARCH_BUDGET = 500;

/**
 * Makes the Daily Crossword of a date, `YYYY-MM-DD`, from an Edition's
 * content (ADR 0052): 4–6 crossing words of 3–5 letters on a 5 × 5 grid, from
 * the Words that are not Retired, clued by their primary Definition, and the
 * one-word main standard forms of the Corrections that are not Retired, clued
 * by their explanation. The same content and date always give the same day.
 * It refuses when the content has errors or no grid can be made.
 */
export function generateDailyCrossword({
  editionDir,
  date,
}: {
  editionDir: string;
  date: string;
}): CrosswordResult {
  if (!CrosswordDaySchema.shape.date.safeParse(date).success) {
    return { ok: false, errors: [{ file: 'content', message: `Not a calendar date: ${date}` }] };
  }
  const source = readEdition(editionDir, { registryRequired: false });
  if (source.errors.length > 0 || source.valid === undefined) {
    return { ok: false, errors: source.errors };
  }
  const supply = crosswordSupply(source.valid.content);
  const words = searchGrid(supply, randomOf(date));
  if (words === undefined) {
    return {
      ok: false,
      errors: [
        {
          file: 'content',
          message: `No Daily Crossword can be made for ${date} from the ${String(supply.length)} words of 3–5 letters`,
        },
      ],
    };
  }
  return { ok: true, day: CrosswordDaySchema.parse({ date, words }) };
}

type Clued = Pick<CrosswordWord, 'entryId' | 'answer' | 'clue'>;

/** The words a crossword may use, each answer once: a Word's before a Correction's. */
function crosswordSupply({ words, corrections }: PackContent): Clued[] {
  const { answer: answerSchema } = CrosswordWordSchema.shape;
  const forms = [
    ...words
      .filter((word) => !word.retired)
      .map((word) => ({ entryId: word.id, form: word.lemma, clue: word.primaryDefinition })),
    ...corrections
      .filter((correction) => !correction.retired)
      .map((correction) => ({
        entryId: correction.id,
        form: correction.standardEquivalents[0] ?? '',
        clue: correction.explanation,
      })),
  ];
  const answers = new Set<string>();
  return forms.flatMap(({ entryId, form, clue }) => {
    const answer = withoutStress(form).normalize('NFC').toLowerCase();
    if (!answerSchema.safeParse(answer).success || answers.has(answer)) return [];
    answers.add(answer);
    return [{ entryId, answer, clue }];
  });
}

/**
 * A depth-first search that adds one crossing word at a time where it keeps
 * the grid reading nothing but its words. It stops at the most words a day
 * may hold, or when its budget runs out, and gives the fullest grid found
 * when that has enough words.
 */
function searchGrid(supply: readonly Clued[], random: () => number): CrosswordWord[] | undefined {
  const lettered = supply.map((clued) => ({ clued, letters: Array.from(clued.answer) }));
  let budget = SEARCH_BUDGET;
  let best: CrosswordWord[] = [];

  function extend(grid: Grid, placed: readonly CrosswordWord[]): boolean {
    if (placed.length > best.length) best = [...placed];
    if (placed.length === CROSSWORD_WORDS.max) return true;
    const used = new Set(placed.map((word) => word.entryId));
    const unused = lettered.filter(({ clued }) => !used.has(clued.entryId));
    for (const next of shuffled(placementsOn(grid, unused), random)) {
      if (budget <= 0) return true;
      budget -= 1;
      if (extend(withWord(grid, next), [...placed, next.word])) return true;
    }
    return false;
  }

  extend({ letters: Array<string>(CROSSWORD_SIZE ** 2).fill(''), across: [], down: [] }, []);
  if (best.length < CROSSWORD_WORDS.min) return undefined;
  return best.toSorted(
    (a, b) => a.row - b.row || a.column - b.column || (a.direction === 'across' ? -1 : 1),
  );
}

/** The letters of a growing grid by cell index, and the cells a placed word runs through each way. */
interface Grid {
  readonly letters: readonly string[];
  readonly across: readonly boolean[];
  readonly down: readonly boolean[];
}

interface Placement {
  readonly word: CrosswordWord;
  readonly cells: readonly number[];
  readonly letters: readonly string[];
}

function withWord(grid: Grid, { word, cells, letters }: Placement): Grid {
  const next = { letters: [...grid.letters], across: [...grid.across], down: [...grid.down] };
  cells.forEach((cell, i) => {
    next.letters[cell] = letters[i] ?? '';
    next[word.direction][cell] = true;
  });
  return next;
}

/**
 * Every place an unused word fits on the grid so that it still reads nothing
 * but its words: inside the grid, with an empty cell or the edge before and
 * after it, crossing a placed word (unless the grid is empty) on agreeing
 * letters and running along no placed word, each new letter with no letter
 * beside it across the word's way, and adding at least one letter.
 */
function placementsOn(
  grid: Grid,
  unused: readonly { clued: Clued; letters: readonly string[] }[],
): Placement[] {
  // Read once: this loop runs millions of times for 400 days.
  const size = CROSSWORD_SIZE;
  const empty = grid.letters.every((letter) => letter === '');
  const letterAt = (row: number, column: number) =>
    row < 0 || column < 0 || row >= size || column >= size
      ? ''
      : (grid.letters[row * size + column] ?? '');
  const placements: Placement[] = [];
  for (const { clued, letters } of unused) {
    const { length } = letters;
    for (const direction of ['across', 'down'] as const) {
      const [dRow, dColumn] = direction === 'across' ? [0, 1] : [1, 0];
      const rows = size - dRow * (length - 1);
      const columns = size - dColumn * (length - 1);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          if (
            letterAt(row - dRow, column - dColumn) !== '' ||
            letterAt(row + dRow * length, column + dColumn * length) !== ''
          ) {
            continue;
          }
          let shared = 0;
          let fits = true;
          for (let i = 0; i < length && fits; i += 1) {
            const r = row + dRow * i;
            const c = column + dColumn * i;
            const cell = r * size + c;
            const letter = grid.letters[cell] ?? '';
            if (letter === '') {
              fits =
                letterAt(r - dColumn, c - dRow) === '' && letterAt(r + dColumn, c + dRow) === '';
            } else {
              fits = letter === letters[i] && grid[direction][cell] !== true;
              shared += 1;
            }
          }
          if (!fits || shared === length || (!empty && shared === 0)) continue;
          const cells = letters.map((_, i) => (row + dRow * i) * size + column + dColumn * i);
          placements.push({ word: { ...clued, row, column, direction }, cells, letters });
        }
      }
    }
  }
  return placements;
}

/** A pseudo-random sequence in [0, 1) seeded by the date, the same on every machine. */
function randomOf(date: string): () => number {
  let state = createHash('sha256').update(`daily-crossword:${date}`).digest().readUInt32LE(0);
  // mulberry32
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
