import { CROSSWORD_SIZE, type Word } from '@slovo/contracts';

import type { Random } from '../ports';
import { shuffled, type PuzzlePlace } from './crossword-puzzle';

/**
 * A block pattern: the rows of a 5 × 5 grid, `#` a block and `.` a white
 * cell. Every pattern is symmetric under a half turn, gives 3–8 Words of 3–5
 * letters, has no run of exactly two cells and no white cell outside a Word
 * (ADR 0087).
 */
export type BlockPattern = readonly string[];

/** The fixed list of block patterns, board 08's four-block lattice first. */
export const CROSSING_PATTERNS: readonly BlockPattern[] = [
  ['.....', '.#.#.', '.....', '.#.#.', '.....'],
  ['.....', '.###.', '.....', '.###.', '.....'],
  ['#....', '.###.', '.....', '.###.', '....#'],
  ['.#.#.', '.#.#.', '.....', '.#.#.', '.#.#.'],
  ['.###.', '.#.#.', '.....', '.#.#.', '.###.'],
  ['.....', '#.##.', '.....', '.##.#', '.....'],
];

/** The shortest and longest Word of the crossing Daily Crossword, in letters. */
export const CROSSING_WORD_LENGTH = { min: 3, max: 5 } as const;

/** Placements the backtracking search tries on one pattern before giving up on it. */
const SEARCH_BUDGET = 1000;

/** How many crossing cells a day pre-fills: two or three. */
const PREFILLED = { min: 2, max: 3 } as const;

export type CrossingDirection = 'across' | 'down';

/**
 * A Word of the crossing Daily Crossword: its number, where it reads from
 * and which way, the Word, its clue (its primary Definition), its letters
 * cell by cell and its Letter Wheel (its letters plus one decoy, shuffled).
 */
export interface CrossingWord {
  readonly number: number;
  readonly direction: CrossingDirection;
  readonly start: PuzzlePlace;
  readonly word: Word;
  readonly clue: string;
  readonly letters: readonly string[];
  readonly wheel: readonly string[];
}

/** A cell the day pre-fills, on a crossing, with its letter. */
export interface CrossingPrefill {
  readonly place: PuzzlePlace;
  readonly letter: string;
}

/** The crossing Daily Crossword of a date: blocks, Words in number order (across before down) and the pre-filled cells. */
export interface CrossingPuzzle {
  /** The local date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly blocks: readonly PuzzlePlace[];
  readonly words: readonly CrossingWord[];
  readonly prefilled: readonly CrossingPrefill[];
}

/** What the generator gives: a puzzle, or `no-fill` when no pattern fills within the search budget. */
export type CrossingGeneration =
  { readonly kind: 'puzzle'; readonly puzzle: CrossingPuzzle } | { readonly kind: 'no-fill' };

/** The cells of a Word, in reading order. */
export function crossingPlacesOf({ start, direction, letters }: CrossingWord): PuzzlePlace[] {
  return letters.map((_, i) =>
    direction === 'across'
      ? { row: start.row, column: start.column + i }
      : { row: start.row + i, column: start.column },
  );
}

/** A run of white cells of a pattern that is a Word, before it has one. */
interface Slot {
  readonly number: number;
  readonly direction: CrossingDirection;
  readonly places: readonly PuzzlePlace[];
}

/** An eligible Word with its letters, one per cell. */
interface Candidate {
  readonly word: Word;
  readonly letters: readonly string[];
}

/** A slot with the Word that fills it. */
interface Filled {
  readonly slot: Slot;
  readonly candidate: Candidate;
}

const placeKey = ({ row, column }: PuzzlePlace) => `${String(row)},${String(column)}`;

/** The pattern's blocks and its Words, numbered in reading order of their first cell. */
function slotsOf(pattern: BlockPattern): { blocks: PuzzlePlace[]; slots: Slot[] } {
  const isWhite = ({ row, column }: PuzzlePlace) => pattern[row]?.[column] === '.';
  const blocks: PuzzlePlace[] = [];
  const runs: Omit<Slot, 'number'>[] = [];
  for (let row = 0; row < CROSSWORD_SIZE; row += 1)
    for (let column = 0; column < CROSSWORD_SIZE; column += 1) {
      const place = { row, column };
      if (!isWhite(place)) {
        blocks.push(place);
        continue;
      }
      for (const direction of ['across', 'down'] as const) {
        const step = (at: PuzzlePlace, by: number): PuzzlePlace =>
          direction === 'across'
            ? { row: at.row, column: at.column + by }
            : { row: at.row + by, column: at.column };
        if (isWhite(step(place, -1))) continue;
        const places: PuzzlePlace[] = [];
        for (let at = place; isWhite(at); at = step(at, 1)) places.push(at);
        if (places.length >= CROSSING_WORD_LENGTH.min) runs.push({ direction, places });
      }
    }
  let number = 0;
  let last = '';
  const slots = runs.map((run) => {
    const start = placeKey(run.places[0] ?? { row: 0, column: 0 });
    if (start !== last) number += 1;
    last = start;
    return { ...run, number };
  });
  return { blocks, slots };
}

/**
 * The Words that can fill a cell run, by their length: a Lemma of 3–5
 * letters of the alphabet (so no space, hyphen or capital), each Lemma once,
 * leaving at least one letter of the alphabet for the decoy.
 */
function candidatesOf(
  words: readonly Word[],
  alphabet: ReadonlySet<string>,
): Map<number, Candidate[]> {
  const byLength = new Map<number, Candidate[]>();
  const seen = new Set<string>();
  for (const word of words) {
    const letters = Array.from(word.lemma);
    const fits =
      letters.length >= CROSSING_WORD_LENGTH.min &&
      letters.length <= CROSSING_WORD_LENGTH.max &&
      letters.every((letter) => alphabet.has(letter)) &&
      new Set(letters).size < alphabet.size &&
      !seen.has(word.lemma);
    if (!fits) continue;
    seen.add(word.lemma);
    const same = byLength.get(letters.length) ?? [];
    same.push({ word, letters });
    byLength.set(letters.length, same);
  }
  return byLength;
}

/**
 * Fills the slots by bounded backtracking: at each step the slot with the
 * fewest fitting Words takes one of them in seeded order; a slot with none
 * steps back. Gives the Word of each slot, or nothing within the budget.
 */
function fill(
  slots: readonly Slot[],
  byLength: ReadonlyMap<number, readonly Candidate[]>,
  random: Random,
): Filled[] | undefined {
  const grid = new Map<string, string>();
  const used = new Set<string>();
  const chosen = new Map<Slot, Candidate>();
  let placements = 0;

  const fitting = (slot: Slot) =>
    (byLength.get(slot.places.length) ?? []).filter(
      ({ word, letters }) =>
        !used.has(word.lemma) &&
        slot.places.every((place, i) => (grid.get(placeKey(place)) ?? letters[i]) === letters[i]),
    );

  const search = (): boolean => {
    let next: { slot: Slot; candidates: Candidate[] } | undefined;
    for (const slot of slots) {
      if (chosen.has(slot)) continue;
      const candidates = fitting(slot);
      if (candidates.length === 0) return false;
      if (next === undefined || candidates.length < next.candidates.length)
        next = { slot, candidates };
    }
    if (next === undefined) return true;
    const { slot } = next;
    for (const candidate of shuffled(next.candidates, random)) {
      if (placements >= SEARCH_BUDGET) return false;
      placements += 1;
      const written = slot.places.flatMap((place, i) =>
        grid.has(placeKey(place)) ? [] : [[placeKey(place), candidate.letters[i] ?? ''] as const],
      );
      written.forEach(([key, letter]) => grid.set(key, letter));
      used.add(candidate.word.lemma);
      chosen.set(slot, candidate);
      if (search()) return true;
      chosen.delete(slot);
      used.delete(candidate.word.lemma);
      written.forEach(([key]) => grid.delete(key));
    }
    return false;
  };

  if (!search()) return undefined;
  return slots.flatMap((slot) => {
    const candidate = chosen.get(slot);
    return candidate === undefined ? [] : [{ slot, candidate }];
  });
}

/** Two or three crossing cells, drawn from the port, none of which completes a Word's letters. */
function prefill(words: readonly CrossingWord[], random: Random): CrossingPrefill[] {
  const letters = new Map<string, string>();
  const owners = new Map<string, CrossingWord[]>();
  for (const word of words)
    crossingPlacesOf(word).forEach((place, i) => {
      const key = placeKey(place);
      letters.set(key, word.letters[i] ?? '');
      owners.set(key, [...(owners.get(key) ?? []), word]);
    });
  const crossings = [...owners.entries()].filter(([, own]) => own.length > 1);
  const target = PREFILLED.min + Math.floor(random.next() * (PREFILLED.max - PREFILLED.min + 1));
  const filled = new Set<string>();
  const prefilled: CrossingPrefill[] = [];
  for (const [key, own] of shuffled(crossings, random)) {
    if (prefilled.length >= target) break;
    const completes = own.some((word) =>
      crossingPlacesOf(word).every(
        (place) => placeKey(place) === key || filled.has(placeKey(place)),
      ),
    );
    if (completes) continue;
    filled.add(key);
    const [row, column] = key.split(',').map(Number);
    prefilled.push({
      place: { row: row ?? 0, column: column ?? 0 },
      letter: letters.get(key) ?? '',
    });
  }
  return prefilled;
}

/** The Word's letters plus one decoy of the alphabet that is not in the Word, shuffled by the port. */
function wheelOf(
  letters: readonly string[],
  alphabet: readonly string[],
  random: Random,
): string[] {
  const decoys = alphabet.filter((letter) => !letters.includes(letter));
  const decoy = decoys[Math.floor(random.next() * decoys.length)] ?? '';
  return shuffled([...letters, decoy], random);
}

/**
 * The crossing Daily Crossword of a date (ADR 0087). Seeds the port with the
 * date and the ids of the Words within the Rarity Ceiling, tries the block
 * patterns in seeded order and fills the first that fills within the search
 * budget; numbers the cells in reading order, pre-fills 2–3 crossing cells
 * and builds each Word's Letter Wheel. The same date, Words and alphabet
 * give the same puzzle; `no-fill` when no pattern fills.
 */
export function generateCrossingCrossword({
  date,
  words,
  alphabet,
  seeded,
}: {
  date: string;
  /** The Words within the Rarity Ceiling, in the Language Pack's order. */
  words: readonly Word[];
  /** The lowercase letters of the Edition's alphabet. */
  alphabet: readonly string[];
  /** The seeded random port of a seed: the only source of chance. */
  seeded: (seed: string) => Random;
}): CrossingGeneration {
  const random = seeded([date, ...words.map(({ id }) => id)].join('\n'));
  const byLength = candidatesOf(words, new Set(alphabet));
  for (const pattern of shuffled(CROSSING_PATTERNS, random)) {
    const { blocks, slots } = slotsOf(pattern);
    const filled = fill(slots, byLength, random);
    if (filled === undefined) continue;
    const crossing = filled.map(({ slot, candidate }): CrossingWord => ({
      number: slot.number,
      direction: slot.direction,
      start: slot.places[0] ?? { row: 0, column: 0 },
      word: candidate.word,
      clue: candidate.word.primaryDefinition,
      letters: candidate.letters,
      wheel: wheelOf(candidate.letters, alphabet, random),
    }));
    return {
      kind: 'puzzle',
      puzzle: { date, blocks, words: crossing, prefilled: prefill(crossing, random) },
    };
  }
  return { kind: 'no-fill' };
}
