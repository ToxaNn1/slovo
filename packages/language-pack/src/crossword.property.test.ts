import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  CorrectionSchema,
  WordSchema,
  type Correction,
  type CrosswordDay,
  type Word,
} from '@slovo/contracts';
import { withoutStress } from '@slovo/core';

import { newCrosswordDays } from './crossword';
import { dateAfter } from './crossword-days';
import type { PackContent } from './pack-layout';

/** Seeded, so CI checks the same inputs on every run. */
const runs = { seed: 20261030, numRuns: 15 };

/** The rules of ADR 0052, written out so that a change to the build's constants breaks them. */
const WORDS_A_DAY = { min: 4, max: 6 };
const LETTERS = { min: 3, max: 5 };
const NO_REPEAT_DAYS = 20;

/** How many days each run appends: more than the no-repeat window. */
const DAYS = 25;

/** How many days ahead `--record` fills. */
const CROSSWORD_DAYS_AHEAD = 400;

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
    examplePair: { nonStandard: `Він каже не${lemma}.`, standard: `Він каже ${form}.` },
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
      minLength: 150,
      maxLength: 240,
      selector: ({ lemma }) => lemma,
    }),
    fc.array(fc.record({ ...drawn, phrase: oneIn(5) }), { maxLength: 40 }),
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
 * The days `--record` appends to content whose last recorded day, its words
 * left out here, is `last`, run on the day that leaves 25 days to fill.
 */
function appendDays(content: PackContent, last: string, kept: readonly CrosswordDay[] = []) {
  return newCrosswordDays(
    { ...content, crosswordDays: [{ date: last, words: [] }, ...kept] },
    dateAfter(last, DAYS - CROSSWORD_DAYS_AHEAD),
  );
}

/**
 * Each draw's days, made once: every property draws the same inputs from
 * its seed, and a draw takes the build about half a second.
 */
const appended = new Map<string, ReturnType<typeof appendDays>>();

/**
 * The days appended after `last`, or none when the supply is too thin for
 * a day: the build's refusal is the expected result then.
 */
function daysOrRefusal(content: PackContent, last: string): readonly CrosswordDay[] {
  const key = JSON.stringify([content, last]);
  const result = appended.get(key) ?? appendDays(content, last);
  appended.set(key, result);
  if (!result.ok) {
    expect(result.errors.map(({ message }) => message)).toEqual([
      expect.stringMatching(/^No Daily Crossword can be made for [\d-]+ from the \d+ words/),
    ]);
    return [];
  }
  expect(result.days.map(({ date }) => date)).toEqual(
    Array.from({ length: DAYS }, (_, i) => dateAfter(last, i + 1)),
  );
  return result.days;
}

const entryIds = (day: CrosswordDay) => day.words.map(({ entryId }) => entryId);

describe('the Daily Crossword days of any pack content and date', { timeout: 60_000 }, () => {
  it('gives every day 4–6 words of 3–5 letters', () => {
    fc.assert(
      fc.property(contents, dates, (content, last) => {
        for (const day of daysOrRefusal(content, last)) {
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
      fc.property(contents, dates, (content, last) => {
        for (const day of daysOrRefusal(content, last)) {
          expect(new Set(entryIds(day)).size).toBe(day.words.length);
        }
      }),
      runs,
    );
  });

  it('brings no word back within 20 days', () => {
    fc.assert(
      fc.property(contents, dates, (content, last) => {
        const days = daysOrRefusal(content, last);
        days.forEach((day, i) => {
          const recent = days.slice(Math.max(0, i - (NO_REPEAT_DAYS - 1)), i).flatMap(entryIds);
          for (const entryId of entryIds(day)) expect(recent).not.toContain(entryId);
        });
      }),
      runs,
    );
  });

  it('picks no Retired Entry', () => {
    fc.assert(
      fc.property(contents, dates, (content, last) => {
        const retired = [...content.words, ...content.corrections]
          .filter((entry) => entry.retired)
          .map(({ id }) => id);
        for (const day of daysOrRefusal(content, last)) {
          for (const entryId of entryIds(day)) expect(retired).not.toContain(entryId);
        }
      }),
      runs,
    );
  });

  it('masks the answer in every clue', () => {
    fc.assert(
      fc.property(contents, dates, (content, last) => {
        for (const day of daysOrRefusal(content, last)) {
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

  it('gives the same days for the same content and date', () => {
    fc.assert(
      fc.property(contents, dates, (content, last) => {
        const days = daysOrRefusal(content, last);
        const again = appendDays(structuredClone(content), last);
        expect(again.ok ? again.days : []).toEqual(days);
      }),
      runs,
    );
  });

  it('appends after recorded days the very days it would have made with them', () => {
    fc.assert(
      fc.property(contents, dates, fc.integer({ min: 1, max: DAYS - 1 }), (content, last, kept) => {
        const days = daysOrRefusal(content, last);
        fc.pre(days.length > 0);
        expect(appendDays(content, last, days.slice(0, kept))).toEqual({
          ok: true,
          days: days.slice(kept),
        });
      }),
      runs,
    );
  });
});
