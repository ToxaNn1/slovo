import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  CorrectionSchema,
  WordSchema,
  type Correction,
  type CrosswordDay,
  type CrosswordWord,
  type Word,
} from '@slovo/contracts';
import { withoutStress } from '@slovo/core';

import { newCrosswordDays } from './crossword';
import { dateAfter } from './crossword-days';
import type { PackContent } from './pack-layout';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261030, numRuns: 15 };

/** The rules of ADR 0052, written out so that a change to the build's constants breaks them. */
const SIZE = 5;
const WORDS_A_DAY = { min: 4, max: 6 };
const LETTERS = { min: 3, max: 5 };
const NO_REPEAT_DAYS = 20;

/**
 * How many days each run appends after its recorded days. Those fill the
 * no-repeat window before them, so a few appended days are enough to check it.
 */
const DAYS = 4;

/** How many days ahead `--record` fills. */
const CROSSWORD_DAYS_AHEAD = 400;

/**
 * How many placements a day's search may try: less than the build's, so a
 * draw builds fast. The rules hold whatever grid the search settles for.
 */
const SEARCH_BUDGET = 80;

/** The combining acute that marks Stress. */
const STRESS = '\u0301';

/**
 * A made-up lemma, consonant then vowel, from few letters so that words
 * cross often; some are 2 or 6 letters long, which no crossword may use.
 */
const lemmas = fc
  .constantFrom(2, 3, 4, 4, 5, 5, 5, 6)
  .chain((length) =>
    fc.tuple(
      ...Array.from({ length }, (_, i) =>
        fc.constantFrom(...Array.from(i % 2 === 0 ? 'кнрт' : 'ао')),
      ),
    ),
  )
  .map((letters) => letters.join(''));

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The lemma with Stress on its first vowel, the second letter. */
const stressed = (lemma: string) => `${lemma.slice(0, 2)}${STRESS}${lemma.slice(2)}`;

/** A clue that names its answer, capitalized and stressed, and again in a sentence. */
const clueNaming = (form: string) =>
  `«${capitalized(stressed(form))}» — вигадане слово; кажуть ${form}, коли інших слів немає.`;

interface Drawn {
  readonly lemma: string;
  readonly retired: boolean;
}

function wordOf({ lemma, retired }: Drawn, i: number): Word {
  return WordSchema.parse({
    kind: 'word',
    id: `w_pt${String(i)}`,
    lemma,
    stress: [1],
    partOfSpeech: 'adverb',
    primaryDefinition: clueNaming(lemma),
    examples: [{ text: `Тут стоїть ${lemma}.` }],
    categoryId: 'speech',
    rarity: 1,
    sources: [{ title: 'Тестове джерело' }],
    retired,
  });
}

/** A Correction whose main standard form is the lemma, or two words when `phrase` is set. */
function correctionOf(
  { lemma, retired, phrase }: Drawn & { readonly phrase: boolean },
  i: number,
): Correction {
  const form = phrase ? `${lemma} так` : lemma;
  return CorrectionSchema.parse({
    kind: 'correction',
    id: `c_pt${String(i)}`,
    nonStandardForm: `не${lemma}`,
    correctionType: 'surzhyk',
    standardEquivalents: [form],
    explanation: clueNaming(form),
    examplePair: { nonStandard: `Він каже не${lemma}.`, standard: `Він каже **${form}**.` },
    categoryId: 'work',
    sources: [{ title: 'Тестове джерело' }],
    retired,
  });
}

/** True about once in `n` draws. */
const oneIn = (n: number) => fc.nat(n - 1).map((draw) => draw === 0);

const drawn = { lemma: lemmas, retired: oneIn(8) };

/** Pack content with short Words and Corrections, some Retired, some two-word Corrections. */
const contents = fc
  .tuple(
    fc.uniqueArray(fc.record(drawn), {
      minLength: 40,
      maxLength: 80,
      selector: ({ lemma }) => lemma,
    }),
    fc.array(fc.record({ ...drawn, phrase: oneIn(5) }), { maxLength: 15 }),
  )
  .map(([words, corrections]): PackContent => ({
    editionId: 'fixture',
    contentVersion: 1,
    categories: [],
    correctionCategories: [],
    words: words.map(wordOf),
    corrections: corrections.map(correctionOf),
    idioms: [],
    synonymRows: [],
    tips: [],
  }));

/** A date of the next ten years. */
const dates = fc
  .date({ min: new Date('2026-01-01T00:00:00Z'), max: new Date('2035-12-31T00:00:00Z') })
  .map((date) => (Number.isNaN(date.getTime()) ? '2026-01-01' : date.toISOString().slice(0, 10)));

/**
 * The days recorded through `last` that fill the no-repeat window before
 * the days to append, each with up to two Entries of the content. Only their
 * ids matter to the build, so the rest of each word is a stand-in.
 */
function recordedDays(
  content: PackContent,
  last: string,
  picks: readonly (readonly number[])[],
): CrosswordDay[] {
  const entries = [...content.words, ...content.corrections];
  return picks.map((picked, i) => ({
    date: dateAfter(last, i + 1 - picks.length),
    words: [...new Set(picked.map((pick) => entries[pick % entries.length]))].flatMap((entry) =>
      entry === undefined
        ? []
        : [{ entryId: entry.id, answer: 'кор', clue: '…', row: 0, column: 0, direction: 'across' }],
    ),
  }));
}

/** Pack content with its crossword days recorded through a date of the next ten years. */
const recorded = fc
  .tuple(
    contents,
    dates,
    fc.array(fc.uniqueArray(fc.nat(), { maxLength: 2 }), {
      minLength: NO_REPEAT_DAYS - 1,
      maxLength: NO_REPEAT_DAYS - 1,
    }),
  )
  .map(([content, last, picks]): PackContent => ({
    ...content,
    crosswordDays: recordedDays(content, last, picks),
  }));

/** The last day recorded in the content. */
const lastOf = (content: PackContent) => content.crosswordDays?.at(-1)?.date ?? '';

/**
 * The days `--record` appends to the content, after its recorded days and
 * the ones kept, run on the day that leaves `DAYS` days to fill.
 */
function appendDays(content: PackContent, kept: readonly CrosswordDay[] = []) {
  return newCrosswordDays(
    { ...content, crosswordDays: [...(content.crosswordDays ?? []), ...kept] },
    dateAfter(lastOf(content), DAYS - CROSSWORD_DAYS_AHEAD),
    { searchBudget: SEARCH_BUDGET },
  );
}

/** Each draw's days, made once: every property draws the same inputs from its seed. */
const appended = new Map<string, ReturnType<typeof appendDays>>();

/**
 * The days appended to the content, or none when the supply is too thin for
 * a day: the build's refusal is the expected result then.
 */
function daysOrRefusal(content: PackContent): readonly CrosswordDay[] {
  const key = JSON.stringify(content);
  const result = appended.get(key) ?? appendDays(content);
  appended.set(key, result);
  if (!result.ok) {
    expect(result.errors.map(({ message }) => message)).toEqual([
      expect.stringMatching(/^No Daily Crossword can be made for [\d-]+ from the \d+ words/),
    ]);
    return [];
  }
  expect(result.days.map(({ date }) => date)).toEqual(
    Array.from({ length: DAYS }, (_, i) => dateAfter(lastOf(content), i + 1)),
  );
  return result.days;
}

const entryIds = (day: CrosswordDay) => day.words.map(({ entryId }) => entryId);

/** The cells a word runs through, each with its row, column and letter. */
function cellsOf({ answer, row, column, direction }: CrosswordWord) {
  return Array.from(answer).map((letter, i) => {
    const [r, c] = direction === 'across' ? [row, column + i] : [row + i, column];
    return { r, c, cell: `${String(r)},${String(c)}`, letter };
  });
}

describe('the Daily Crossword grid of any pack content and date', () => {
  it('fits every word on the 5 × 5 board', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        for (const { r, c } of daysOrRefusal(content).flatMap((day) =>
          day.words.flatMap(cellsOf),
        )) {
          expect([r, c].every((index) => index >= 0 && index < SIZE)).toBe(true);
        }
      }),
      runs,
    );
  });

  it('gives crossing words the same letter where they cross', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        for (const day of daysOrRefusal(content)) {
          const letters = new Map<string, string>();
          for (const { cell, letter } of day.words.flatMap(cellsOf)) {
            expect(letters.get(cell) ?? letter).toBe(letter);
            letters.set(cell, letter);
          }
        }
      }),
      runs,
    );
  });

  it('lets two words share a cell only where an across word crosses a down word', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        for (const day of daysOrRefusal(content)) {
          for (const direction of ['across', 'down'] as const) {
            const cells = day.words
              .filter((word) => word.direction === direction)
              .flatMap(cellsOf)
              .map(({ cell }) => cell);
            expect(new Set(cells).size).toBe(cells.length);
          }
        }
      }),
      runs,
    );
  });

  it('gives the same grid for the same content and date', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        const again = appendDays(structuredClone(content));
        expect(again.ok ? again.days : []).toEqual(daysOrRefusal(content));
      }),
      runs,
    );
  });
});

describe('the Daily Crossword days of any pack content and date', () => {
  it('gives every day 4–6 words of 3–5 letters', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        for (const day of daysOrRefusal(content)) {
          expect(day.words.length).toBeGreaterThanOrEqual(WORDS_A_DAY.min);
          expect(day.words.length).toBeLessThanOrEqual(WORDS_A_DAY.max);
          for (const { answer } of day.words) {
            expect(Array.from(answer).length).toBeGreaterThanOrEqual(LETTERS.min);
            expect(Array.from(answer).length).toBeLessThanOrEqual(LETTERS.max);
            expect(answer).toMatch(/^\p{L}+$/u);
          }
        }
      }),
      runs,
    );
  });

  it('uses each Entry at most once in a day', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        for (const day of daysOrRefusal(content)) {
          expect(new Set(entryIds(day)).size).toBe(day.words.length);
        }
      }),
      runs,
    );
  });

  it('brings no word back within 20 days, recorded or appended', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        const before = content.crosswordDays ?? [];
        const days = [...before, ...daysOrRefusal(content)];
        days.slice(before.length).forEach((day, i) => {
          const at = before.length + i;
          const recent = days.slice(at - (NO_REPEAT_DAYS - 1), at).flatMap(entryIds);
          for (const entryId of entryIds(day)) expect(recent).not.toContain(entryId);
        });
      }),
      runs,
    );
  });

  it('picks no Retired Entry', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        const retired = [...content.words, ...content.corrections]
          .filter((entry) => entry.retired)
          .map(({ id }) => id);
        for (const day of daysOrRefusal(content)) {
          for (const entryId of entryIds(day)) expect(retired).not.toContain(entryId);
        }
      }),
      runs,
    );
  });

  it('masks the answer in every clue', () => {
    fc.assert(
      fc.property(recorded, (content) => {
        for (const day of daysOrRefusal(content)) {
          for (const { answer, clue } of day.words) {
            const clueWords =
              withoutStress(clue)
                .toLowerCase()
                .match(/\p{L}[\p{L}ʼ'’]*/gu) ?? [];
            expect(clueWords).not.toContain(answer);
            expect(clue).toContain('…');
          }
        }
      }),
      runs,
    );
  });

  it('appends after recorded days the very days it would have made with them', () => {
    fc.assert(
      fc.property(recorded, fc.integer({ min: 1, max: DAYS - 1 }), (content, kept) => {
        const days = daysOrRefusal(content);
        fc.pre(days.length > 0);
        expect(appendDays(content, days.slice(0, kept))).toEqual({
          ok: true,
          days: days.slice(kept),
        });
      }),
      runs,
    );
  });
});
