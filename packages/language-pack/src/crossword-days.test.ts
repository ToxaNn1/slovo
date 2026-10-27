import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { CrosswordDay } from '@slovo/contracts';

import { buildLanguagePack, formatBuildError, openLanguagePack, recordContent } from './index';

const fixtureDir = fileURLToPath(new URL('../fixtures/valid', import.meta.url));
const DAYS_FILE = 'content/crossword-days.json';
const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Short made-up lemmas, consonant then vowel, so that 3–5-letter words
 * enough for 30 days of crosswords cross each other.
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

/**
 * A copy of the fixture Edition with 300 short Words, recorded, that keeps
 * the crossword days given, `[]` by default.
 */
function editionWithDays(days: readonly CrosswordDay[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-crossword-days-'));
  workDirs.push(dir);
  const editionDir = join(dir, 'edition');
  cpSync(fixtureDir, editionDir, { recursive: true });
  LEMMAS.forEach((lemma, i) => {
    const id = `w_cw${String(i).padStart(4, '0')}`;
    const word = {
      id,
      lemma,
      stress: [1],
      partOfSpeech: 'adverb',
      primaryDefinition: `Вигадане слово номер ${String(i + 1)}.`,
      examples: [{ text: `Тут стоїть ${lemma}.` }],
      categoryId: 'speech',
      rarity: 1,
      sources: [{ title: 'Тестове джерело' }],
    };
    writeFileSync(join(editionDir, 'content', 'words', `${id}.json`), JSON.stringify(word));
  });
  writeFileSync(join(editionDir, DAYS_FILE), `${JSON.stringify(days, null, 2)}\n`);
  return editionDir;
}

const daysText = (editionDir: string) => readFileSync(join(editionDir, DAYS_FILE), 'utf8');
const daysOf = (editionDir: string) => JSON.parse(daysText(editionDir)) as CrosswordDay[];

function record(editionDir: string, today: string) {
  const result = recordContent({ editionDir, today: new Date(`${today}T12:00:00Z`) });
  if (!result.ok) throw new Error(result.errors.map(formatBuildError).join('\n'));
  return result;
}

function recordErrors(editionDir: string, today: string): string[] {
  const result = recordContent({ editionDir, today: new Date(`${today}T12:00:00Z`) });
  return result.ok ? [] : result.errors.map(formatBuildError);
}

function buildErrors(editionDir: string): string[] {
  const result = buildLanguagePack({ editionDir, outFile: join(editionDir, 'dist', 'pack.db') });
  return result.ok ? [] : result.errors.map(formatBuildError);
}

const dayAfter = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe('the crossword days the pack build keeps in the Edition', () => {
  let recorded: CrosswordDay[] = [];
  let recordedText = '';

  beforeAll(() => {
    const editionDir = editionWithDays();
    record(editionDir, '2027-01-01');
    recorded = daysOf(editionDir);
    recordedText = daysText(editionDir);
  }, 120_000);

  it('appends days from today on so that 400 lie ahead, one a day', () => {
    expect(recorded[0]?.date).toBe('2027-01-01');
    expect(recorded.at(-1)?.date).toBe('2028-02-05');
    expect(recorded).toHaveLength(401);
    recorded.forEach((day, i) => {
      expect(day.date).toBe(dayAfter('2027-01-01', i));
    });
  });

  it('repeats no word within 30 days', () => {
    recorded.forEach((day, i) => {
      const recent = recorded.slice(Math.max(0, i - 29), i).flatMap(({ words }) => words);
      for (const { entryId } of day.words) {
        expect(recent.map((word) => word.entryId)).not.toContain(entryId);
      }
    });
  });

  it('appends later days and keeps the days already there byte-identical', () => {
    const editionDir = editionWithDays();
    writeFileSync(join(editionDir, DAYS_FILE), recordedText);
    record(editionDir, '2027-01-01');

    const result = record(editionDir, '2027-01-11');
    const text = daysText(editionDir);
    expect(result.newCrosswordDays).toEqual(
      Array.from({ length: 10 }, (_, i) => dayAfter('2028-02-06', i)),
    );
    expect(text.startsWith(recordedText.slice(0, -'\n]\n'.length))).toBe(true);
    expect(daysOf(editionDir).slice(0, recorded.length)).toEqual(recorded);
    expect(record(editionDir, '2027-01-11').newCrosswordDays).toEqual([]);
    expect(daysText(editionDir)).toBe(text);
    expect(buildErrors(editionDir)).toEqual([]);
  }, 60_000);

  it('builds the recorded days into pack format 6', async () => {
    const editionDir = editionWithDays(recorded);
    record(editionDir, '2027-01-01');
    const outFile = join(editionDir, 'dist', 'language-pack.db');
    const result = buildLanguagePack({ editionDir, outFile });
    expect(result.ok && result.metadata.packFormat).toBe(6);
    const pack = openLanguagePack(outFile);
    try {
      expect(await pack.crosswordDay('2027-06-15')).toEqual(
        recorded.find((day) => day.date === '2027-06-15'),
      );
      expect(await pack.crosswordDay('2028-02-06')).toBeUndefined();
    } finally {
      pack.close();
    }
  }, 60_000);

  it('keeps a day whose Entry was Retired later', () => {
    const editionDir = editionWithDays(recorded);
    record(editionDir, '2027-01-01');
    const wordId = recorded[0]?.words.find(({ entryId }) => entryId.startsWith('w_'))?.entryId;
    if (wordId === undefined) throw new Error('No Word in the first day');
    const wordFile = join(editionDir, 'content', 'words', `${wordId}.json`);
    const word = JSON.parse(readFileSync(wordFile, 'utf8')) as Record<string, unknown>;
    writeFileSync(wordFile, `${JSON.stringify({ ...word, retired: true }, null, 2)}\n`);

    expect(record(editionDir, '2027-01-02').newCrosswordDays).toEqual(['2028-02-06']);
    expect(daysOf(editionDir).slice(0, recorded.length)).toEqual(recorded);
    expect(buildErrors(editionDir)).toEqual([]);
  }, 60_000);

  it('refuses a published day that changed, and a day appended by hand', () => {
    const editionDir = editionWithDays(recorded);
    record(editionDir, '2027-01-01');
    const message = `${DAYS_FILE}: Not the days last recorded: a published day never changes and only pnpm build:pack fixture --record appends days, so restore the file from git`;

    const changed = recorded.map((day, i) =>
      i === 5
        ? { ...day, words: day.words.map((word) => ({ ...word, clue: 'Інша підказка' })) }
        : day,
    );
    writeFileSync(join(editionDir, DAYS_FILE), `${JSON.stringify(changed, null, 2)}\n`);
    expect(recordErrors(editionDir, '2027-01-01')).toEqual([message]);
    expect(buildErrors(editionDir)).toContain(message);

    const extra = { ...recorded[0], date: '2028-02-06' } as CrosswordDay;
    writeFileSync(join(editionDir, DAYS_FILE), JSON.stringify([...recorded, extra]));
    expect(recordErrors(editionDir, '2027-01-01')).toContain(message);
  }, 60_000);

  it('refuses a gap between days', () => {
    const [first, , third] = recorded;
    if (first === undefined || third === undefined) throw new Error('Too few days');
    const editionDir = editionWithDays([first, third]);
    expect(recordErrors(editionDir, '2027-01-01')).toEqual([
      `${DAYS_FILE} › 1.date: Expected 2027-01-02, the day after the one before: the days run without a gap`,
    ]);
  }, 60_000);

  it('refuses a word repeated within 30 days', () => {
    const [first, second] = recorded;
    if (first === undefined || second === undefined) throw new Error('Too few days');
    const repeated = { ...second, words: first.words };
    const editionDir = editionWithDays([first, repeated]);
    expect(recordErrors(editionDir, '2027-01-01')).toEqual(
      first.words.map(
        ({ entryId }, i) =>
          `${DAYS_FILE} › 1.words.${String(i)}.entryId: ${entryId} is also in the day of 2027-01-01: a word comes back only 30 days or more later`,
      ),
    );
  }, 60_000);
});
