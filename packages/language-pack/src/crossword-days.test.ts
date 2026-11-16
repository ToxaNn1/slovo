import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, describe, expect, it } from 'vitest';

import type { CrosswordDay } from '@slovo/contracts';
import { ContentSnapshotSchema, type ContentSnapshot } from '@slovo/contracts/api';

import { newCrosswordDays } from './crossword';
import { buildFromSnapshot, formatBuildError, readEditionWithSnapshot } from './index';
import type { PackContent } from './pack-layout';
import { fixtureDir, ukrainianFolder, ukrainianSnapshot, validSnapshot } from './test-support';

/** The file the content rules name in the errors of crossword days. */
const DAYS = 'snapshot:crosswordDays';
const TODAY = new Date('2026-11-16T12:00:00Z');

/** How many placements a day's search may try: less than the build's, so 400 days build fast. */
const SEARCH_BUDGET = 100;

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Short made-up lemmas, consonant then vowel, so that 3–5-letter words
 * enough for a month of crosswords cross each other.
 */
const LEMMAS = (() => {
  const [consonants, vowels] = [Array.from('бвдклмнпрст'), Array.from('аоуеи')];
  const lemmas = new Set<string>();
  for (let seed = 1; lemmas.size < 300; seed += 1) {
    let n = seed;
    const letters = Array.from({ length: 3 + (seed % 3) }, (_, j) => {
      const set = j % 2 === 0 ? consonants : vowels;
      n = (n * 1_103_515_245 + 12_345) % 2_147_483_648;
      return set[n % set.length] ?? '';
    });
    lemmas.add(letters.join(''));
  }
  return [...lemmas];
})();

/** The fixture Edition's snapshot with 300 short Words besides its own. */
const snapshot: ContentSnapshot = (() => {
  const fixture = validSnapshot();
  const words = LEMMAS.map((lemma, i) => ({
    kind: 'word',
    id: `w_cw${String(i).padStart(4, '0')}`,
    lemma,
    stress: [1],
    partOfSpeech: 'adverb',
    primaryDefinition: `Вигадане слово номер ${String(i + 1)}.`,
    examples: [{ text: `Тут стоїть ${lemma}.` }],
    categoryId: 'speech',
    rarity: 1,
    sources: [{ title: 'Тестове джерело' }],
  }));
  return ContentSnapshotSchema.parse({ ...fixture, words: [...fixture.words, ...words] });
})();

/** The snapshot's content with the crossword days given, checked as the build checks it. */
function contentWith(source: ContentSnapshot, days: readonly CrosswordDay[]): PackContent {
  const editionDir = source.editionId === 'uk' ? ukrainianFolder.dir : fixtureDir('valid');
  const { errors, valid } = readEditionWithSnapshot(
    editionDir,
    { ...source, crosswordDays: [...days] },
    { today: TODAY },
  );
  if (valid === undefined) throw new Error(errors.map(formatBuildError).join('\n'));
  return valid.content;
}

/** The days the build appends on `today` after the days given, each day's search within the budget. */
function appended(
  days: readonly CrosswordDay[],
  today: string,
  {
    source = snapshot,
    searchBudget = SEARCH_BUDGET,
  }: { source?: ContentSnapshot; searchBudget?: number } = {},
): readonly CrosswordDay[] {
  const result = newCrosswordDays(contentWith(source, days), today, { searchBudget });
  if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
  return result.days;
}

/** The errors of a pack build from the snapshot with the crossword days given. */
function buildErrors(days: readonly CrosswordDay[], source: ContentSnapshot = snapshot): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-crossword-days-'));
  workDirs.push(dir);
  const result = buildFromSnapshot({
    editionDir: source.editionId === 'uk' ? ukrainianFolder.dir : fixtureDir('valid'),
    snapshot: { ...source, crosswordDays: [...days] },
    outFile: join(dir, 'pack.db'),
    today: TODAY,
  });
  return result.ok ? [] : result.errors.map(formatBuildError);
}

const dayAfter = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('the crossword days the pack build appends', () => {
  // Made once for the whole block: 401 days.
  const recorded = appended([], '2027-01-01');

  it('appends days from today on so that 400 lie ahead, one a day', () => {
    expect(recorded[0]?.date).toBe('2027-01-01');
    expect(recorded.at(-1)?.date).toBe('2028-02-05');
    expect(recorded).toHaveLength(401);
    recorded.forEach((day, i) => {
      expect(day.date).toBe(dayAfter('2027-01-01', i));
    });
  });

  it('repeats no word within 20 days', () => {
    recorded.forEach((day, i) => {
      const recent = recorded.slice(Math.max(0, i - 19), i).flatMap(({ words }) => words);
      for (const { entryId } of day.words) {
        expect(recent.map((word) => word.entryId)).not.toContain(entryId);
      }
    });
  });

  it('appends later days after the days already there, the same days whenever it runs', () => {
    const later = appended(recorded, '2027-01-11');
    expect(later.map(({ date }) => date)).toEqual(
      Array.from({ length: 10 }, (_, i) => dayAfter('2028-02-06', i)),
    );
    expect(appended(recorded, '2027-01-06')).toEqual(later.slice(0, 5));
    expect(appended([...recorded, ...later], '2027-01-11')).toEqual([]);
    expect(buildErrors([...recorded, ...later])).toEqual([]);
  }, 60_000);

  it('builds the days into pack format 13', () => {
    const dir = mkdtempSync(join(tmpdir(), 'slovo-crossword-days-'));
    workDirs.push(dir);
    const outFile = join(dir, 'language-pack.db');
    const result = buildFromSnapshot({
      editionDir: fixtureDir('valid'),
      snapshot: { ...snapshot, crosswordDays: [...recorded] },
      outFile,
      today: TODAY,
    });
    expect(result.ok && result.metadata.packFormat).toBe(13);
    const db = new DatabaseSync(outFile, { readOnly: true });
    try {
      const wordsOf = (date: string) =>
        db
          .prepare(
            'SELECT entry_id, answer, clue, start_row, start_column, direction FROM crossword_words WHERE date = ? ORDER BY position',
          )
          .all(date)
          .map((row) => ({
            entryId: row['entry_id'],
            answer: row['answer'],
            clue: row['clue'],
            row: row['start_row'],
            column: row['start_column'],
            direction: row['direction'],
          }));
      expect(wordsOf('2027-06-15')).toEqual(
        recorded.find((day) => day.date === '2027-06-15')?.words,
      );
      expect(wordsOf('2028-02-06')).toEqual([]);
    } finally {
      db.close();
    }
  }, 60_000);

  it('keeps a day whose Entry was Retired later', () => {
    const wordId = recorded[0]?.words.find(({ entryId }) => entryId.startsWith('w_'))?.entryId;
    if (wordId === undefined) throw new Error('No Word in the first day');
    const retired: ContentSnapshot = {
      ...snapshot,
      words: snapshot.words.map((word) => (word.id === wordId ? { ...word, retired: true } : word)),
    };

    const next = appended(recorded, '2027-01-02', { source: retired });
    expect(next.map(({ date }) => date)).toEqual(['2028-02-06']);
    expect(next.flatMap(({ words }) => words.map(({ entryId }) => entryId))).not.toContain(wordId);
    expect(buildErrors(recorded, retired)).toEqual([]);
  }, 60_000);

  it('refuses a gap between days', () => {
    const [first, , third] = recorded;
    if (first === undefined || third === undefined) throw new Error('Too few days');
    expect(buildErrors([first, third])).toEqual([
      `${DAYS} › 1.date: Expected 2027-01-02, the day after the one before: the days run without a gap`,
    ]);
  });

  it('refuses a word repeated within 20 days', () => {
    const [first, second] = recorded;
    if (first === undefined || second === undefined) throw new Error('Too few days');
    const repeated = { ...second, words: first.words };
    expect(buildErrors([first, repeated])).toEqual(
      first.words.map(
        ({ entryId }, i) =>
          `${DAYS} › 1.words.${String(i)}.entryId: ${entryId} is also in the day of 2027-01-01: a word comes back only 20 days or more later`,
      ),
    );
  });
});

describe("the crossword days of the UA Edition's content", () => {
  it('reach 400 days ahead, no word coming back within 20 days', () => {
    const uk = ukrainianSnapshot();
    // Half a year past the snapshot's days' start, so the build appends new days too.
    // The build's own budget: the UA supply is too thin for a smaller one.
    const next = appended(uk.crosswordDays, '2027-06-01', { source: uk, searchBudget: 500 });

    expect(next.at(-1)?.date).toBe(dayAfter('2027-06-01', 400));
    expect(buildErrors([...uk.crosswordDays, ...next], uk)).toEqual([]);
  }, 120_000);
});
