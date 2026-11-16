import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { CrosswordDay } from '@slovo/contracts';
import { ContentSnapshotSchema, type ContentSnapshot } from '@slovo/contracts/api';

import { newCrosswordDays } from './crossword';
import { CROSSWORD_DAYS_AHEAD, dateAfter } from './crossword-days';
import { buildFromSnapshot, formatBuildError, readEditionWithSnapshot } from './index';
import type { PackContent } from './pack-layout';
import { fixtureDir, ukrainianFolder, ukrainianSnapshot, validSnapshot } from './test-support';

const seed = ukrainianSnapshot();
/** The file the content rules name in the errors of crossword days. */
const DAYS = 'snapshot:crosswordDays';
const TODAY = new Date('2026-11-16T12:00:00Z');

/** How many placements a day's search may try: less than the build's, so the days build fast. */
const SEARCH_BUDGET = 100;

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The checked content of a snapshot with an Edition's folder, or its errors joined into one. */
function contentOrErrors(
  editionDir: string,
  snapshot: ContentSnapshot,
  today = TODAY,
): { content: PackContent } | { errors: string[] } {
  const { errors, valid } = readEditionWithSnapshot(editionDir, snapshot, { today });
  if (valid === undefined) return { errors: errors.map(formatBuildError) };
  return { content: valid.content };
}

function contentOf(editionDir: string, snapshot: ContentSnapshot): PackContent {
  const read = contentOrErrors(editionDir, snapshot);
  if ('errors' in read) throw new Error(read.errors.join('\n'));
  return read.content;
}

/** The UA content with no crossword days, so each is made afresh. */
const ukrainian = contentOf(ukrainianFolder.dir, { ...seed, crosswordDays: [] });

/**
 * The Daily Crosswords the build makes from `first` on, `count` of them, as
 * it appends them after a day with no words.
 */
function daysResult(content: PackContent, first: string, count: number) {
  return newCrosswordDays(
    { ...content, crosswordDays: [{ date: dateAfter(first, -1), words: [] }] },
    dateAfter(first, count - 1 - CROSSWORD_DAYS_AHEAD),
    { searchBudget: SEARCH_BUDGET },
  );
}

function daysFrom(content: PackContent, first: string, count: number): readonly CrosswordDay[] {
  const result = daysResult(content, first, count);
  if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
  return result.days;
}

/** The 5 × 5 grid the words fill, a row a line, `.` for an empty cell. */
function gridOf(day: CrosswordDay): string[] {
  const rows = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => '.'));
  for (const { answer, row, column, direction } of day.words) {
    Array.from(answer).forEach((letter, i) => {
      const [r, c] = direction === 'across' ? [row, column + i] : [row + i, column];
      const line = rows[r];
      if (line === undefined || c >= 5) throw new Error(`${answer} runs past the grid`);
      line[c] = letter;
    });
  }
  return rows.map((line) => line.join(''));
}

/** What the grid reads along a word's cells. */
function readAlong(
  grid: readonly string[],
  { answer, row, column, direction }: CrosswordDay['words'][number],
) {
  return Array.from(answer)
    .map((_, i) => (direction === 'across' ? grid[row]?.[column + i] : grid[row + i]?.[column]))
    .join('');
}

/** Every run of two or more letters in the grid's rows and columns. */
function runsOf(grid: readonly string[]): string[] {
  const columns = [0, 1, 2, 3, 4].map((c) => grid.map((line) => line[c]).join(''));
  return [...grid, ...columns].flatMap((line) => line.split('.').filter((run) => run.length >= 2));
}

function cellsOf({ answer, row, column, direction }: CrosswordDay['words'][number]): string[] {
  return Array.from(answer).map((_, i) =>
    direction === 'across'
      ? `${String(row)},${String(column + i)}`
      : `${String(row + i)},${String(column)}`,
  );
}

/** A clue with each whole-word occurrence of its answer, ignoring case and Stress, as «…». */
function maskedAnswer(text: string, answer: string): string {
  const words = text.split(/(\p{L}[\p{L}\p{M}ʼ'’]*)/u);
  return words
    .map((word) => (word.replaceAll('́', '').toLowerCase() === answer ? '…' : word))
    .join('');
}

interface EntryRecord {
  lemma?: string;
  primaryDefinition?: string;
  standardEquivalents?: readonly string[];
  explanation?: string;
  retired?: boolean;
}

function entryRecord(id: string): EntryRecord {
  const entry = [...seed.words, ...seed.corrections].find((record) => record.id === id);
  if (entry === undefined) throw new Error(`No Entry ${id} in the seed snapshot`);
  return entry;
}

describe('the Daily Crossword the pack build makes', () => {
  const month = daysFrom(ukrainian, '2027-01-01', 20);

  it('gives the same grid for the same date, and another for another date', () => {
    expect(daysFrom(ukrainian, '2027-01-01', 1)).toEqual(month.slice(0, 1));
    expect(month[0]?.date).toBe('2027-01-01');
    expect(new Set(month.map((day) => gridOf(day).join('/'))).size).toBeGreaterThan(15);
  });

  it('fills a 5 × 5 grid with 4–6 crossing words of 3–5 letters that read correctly', () => {
    for (const day of month) {
      const grid = gridOf(day);
      expect(day.words.length).toBeGreaterThanOrEqual(4);
      expect(day.words.length).toBeLessThanOrEqual(6);
      for (const word of day.words) {
        expect(Array.from(word.answer).length).toBeGreaterThanOrEqual(3);
        expect(Array.from(word.answer).length).toBeLessThanOrEqual(5);
        expect(readAlong(grid, word)).toBe(word.answer);
        const others = day.words.filter((other) => other !== word).flatMap(cellsOf);
        expect(cellsOf(word).some((cell) => others.includes(cell))).toBe(true);
      }
      expect(runsOf(grid).toSorted()).toEqual(day.words.map((word) => word.answer).toSorted());
      expect(new Set(day.words.map((word) => word.entryId)).size).toBe(day.words.length);
    }
  });

  it("clues each word with its Word's primary Definition or its Correction's explanation, never a Retired Entry's", () => {
    for (const { entryId, answer, clue } of month.flatMap((day) => day.words)) {
      const entry = entryRecord(entryId);
      expect(entry.retired ?? false).toBe(false);
      if (entryId.startsWith('w_')) {
        expect(answer).toBe(entry.lemma?.toLowerCase());
        expect(clue).toBe(entry.primaryDefinition);
      } else {
        expect(answer).toBe(entry.standardEquivalents?.[0]?.replaceAll('́', '').toLowerCase());
        expect(clue).toBe(maskedAnswer(entry.explanation ?? '', answer));
      }
    }
  });

  it('puts «…» in place of every whole-word occurrence of the answer in a clue, ignoring case and Stress', () => {
    const kept = new Map<string, string>();
    const corrections = seed.corrections.map((correction) => {
      const [form] = correction.standardEquivalents;
      const named = `${form.charAt(0).toUpperCase()}${form.slice(1)}`;
      kept.set(correction.id, `${form}ик`);
      return {
        ...correction,
        explanation: `${named} пишуть так. Кажуть «${form}», а не «${form}ик».`,
      };
    });
    const content = contentOf(ukrainianFolder.dir, { ...seed, corrections, crosswordDays: [] });
    const clued = daysFrom(content, '2027-01-01', 30)
      .flatMap((day) => day.words)
      .filter(({ entryId }) => entryId.startsWith('c_'));

    expect(clued.length).toBeGreaterThan(0);
    for (const { entryId, clue } of clued) {
      expect(clue).toBe(`… пишуть так. Кажуть «…», а не «${kept.get(entryId) ?? ''}».`);
    }
  });

  it("refuses when no grid can be made from the Edition's words", () => {
    const result = daysResult(contentOf(fixtureDir('valid'), validSnapshot()), '2027-01-01', 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map(formatBuildError)).toEqual([
      'content: No Daily Crossword can be made for 2027-01-01 from the 0 words of 3–5 letters',
    ]);
  });

  it('judges the public domain of the content on the given day', () => {
    const snapshot = validSnapshot();
    const use = { text: 'Він прийшов.', author: 'Автор', work: 'Твір', authorDeathYear: 2000 };
    const corrections = snapshot.corrections.map((correction) =>
      correction.id === 'c_fx0001' ? { ...correction, literaryUses: [use] } : correction,
    );
    const errorsOn = (today: Date) => {
      const read = contentOrErrors(fixtureDir('valid'), { ...snapshot, corrections }, today);
      if ('errors' in read) return read.errors;
      const result = daysResult(read.content, '2027-01-01', 1);
      return result.ok ? [] : result.errors.map(formatBuildError);
    };

    expect(errorsOn(new Date(2080, 0, 1))).toEqual([
      'content: No Daily Crossword can be made for 2027-01-01 from the 0 words of 3–5 letters',
    ]);
    expect(errorsOn(new Date(2030, 0, 1))).toEqual([
      expect.stringMatching(/c_fx0001.*literaryUses\.0\.authorDeathYear/),
    ]);
  });
});

describe('the crossword days of an Edition', () => {
  it('refuses a day whose grid breaks the rules, or whose words are not Entries of the Edition', () => {
    const dir = mkdtempSync(join(tmpdir(), 'slovo-crossword-'));
    workDirs.push(dir);
    const [day] = daysFrom(ukrainian, '2027-01-01', 1);
    if (day === undefined) throw new Error('No day');
    const [first, second, ...others] = day.words;
    if (first === undefined || second === undefined) throw new Error('Too few words');
    // The snapshot is parsed where it enters, so a day breaking a grid rule never reaches the build.
    const issuesWith = (days: unknown[]) => {
      const parsed = ContentSnapshotSchema.safeParse({ ...seed, crosswordDays: days });
      return parsed.success
        ? []
        : parsed.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`);
    };

    expect(issuesWith([day])).toEqual([]);
    expect(
      issuesWith([{ ...day, words: [{ ...first, row: 4, column: 4 }, second, ...others] }]),
    ).toContain('crosswordDays.0.words.0: Runs past the edge of the grid');
    expect(
      issuesWith([{ ...day, words: [first, { ...second, entryId: first.entryId }, ...others] }]),
    ).toContain(`crosswordDays.0.words.1.entryId: ${first.entryId} is already a word of the day`);

    const result = buildFromSnapshot({
      editionDir: fixtureDir('valid'),
      snapshot: { ...validSnapshot(), crosswordDays: [day] },
      outFile: join(dir, 'pack.db'),
      today: TODAY,
    });
    expect(result.ok ? [] : result.errors.map(formatBuildError)).toContain(
      `${DAYS} › 0.words.0.entryId: No Word or Correction ${first.entryId} in the Edition`,
    );
  });
});
