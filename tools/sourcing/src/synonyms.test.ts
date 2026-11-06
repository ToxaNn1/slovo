import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SynonymRowSchema } from '@slovo/contracts';
import {
  EDITIONS_DIR,
  editionFiles,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

import { sourceSynonyms, type Fetch, type LemmaOutcome, type SourcingResult } from './index';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const ukrainianConfigFile = openEdition(EDITIONS_DIR, 'uk').path('config');
const SYNONYMS = 'https://goroh.pp.ua/Синонімія/';

/** Saved goroh «Синонімія» pages; any other address is goroh's "not found" page. */
const savedPages: Record<string, string> = {
  мжичка: 'goroh/synonyms-mzhychka.html',
  косий: 'goroh/synonyms-kosa.html',
  пасмо: 'goroh/synonyms-llm.html',
};

function fakeFetch(requests: string[]): Fetch {
  return (url) => {
    const address = decodeURI(url);
    requests.push(address);
    const saved = address.startsWith(SYNONYMS)
      ? savedPages[address.slice(SYNONYMS.length)]
      : undefined;
    return Promise.resolve(
      saved === undefined
        ? { status: 404, body: readFixture('goroh/not-found.html') }
        : { status: 200, body: readFixture(saved) },
    );
  };
}

function readFixture(file: string): string {
  return readFileSync(join(fixturesDir, file), 'utf8');
}

/** A virtual clock: every sleep ends at once and moves the time on. */
function fakeClock() {
  let time = 1_000_000;
  return {
    now: () => time,
    sleep: (ms: number) => {
      time += ms;
      return Promise.resolve();
    },
  };
}

/** A copy of the UA Edition's config with the given Entries as its content. */
function editionWith(entries: Record<string, unknown> = {}): EditionFolder {
  const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  mkdirSync(join(editionsDir, 'uk'));
  writeFileSync(
    editionFiles(join(editionsDir, 'uk')).path('config'),
    readFileSync(ukrainianConfigFile, 'utf8'),
  );
  const edition = openEdition(editionsDir, 'uk');
  for (const [id, entry] of Object.entries(entries)) {
    const file = join(edition.dir, edition.entryFile(id));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(entry));
  }
  return edition;
}

const mrjaka = {
  id: 'w_mrjaka',
  lemma: 'мряка',
  stress: [2],
  partOfSpeech: 'noun',
  gender: 'feminine',
  primaryDefinition: 'Густий дрібний дощ.',
  categoryId: 'nature-weather',
  rarity: 1,
  sources: [{ title: 'Тестове джерело' }],
};

async function run(list: string, edition = editionWith()) {
  const requests: string[] = [];
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-sourcing-'));
  const outDir = join(workDir, 'review');
  const result = await sourceSynonyms({
    list,
    edition,
    outDir,
    cacheDir: join(workDir, 'cache'),
    fetch: fakeFetch(requests),
    clock: fakeClock(),
    random: Math.random,
  });
  return { result, requests, edition, dir: join(outDir, 'synonyms') };
}

function lemmasOf(result: SourcingResult): readonly LemmaOutcome[] {
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.report.lemmas;
}

function readDraft(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(join(dir, file), 'utf8'));
}

describe('sourceSynonyms', () => {
  it('drafts a ready row: the dominant with its Stress, the sense line, members with Stress and shade notes', async () => {
    const { result, dir, edition } = await run('мжичка\n');

    const [lemma] = lemmasOf(result);
    expect(lemma?.lemma).toBe('мжичка:1');
    const [draft] = lemma?.drafts ?? [];
    expect(draft).toMatchObject({ ready: true, issues: [], flags: [] });
    const row = readDraft(dir, draft?.file ?? '');
    expect(row).toEqual({
      id: draft?.id,
      dominant: { text: 'мжичка', stress: [2] },
      meaning: 'Дуже дрібний і густий дощ.',
      members: [
        { text: 'мжа', stress: [2] },
        { text: 'мжиця', stress: [2] },
        {
          text: 'мряка',
          stress: [2],
          shadeNote: 'густий дрібний дощ, краплини якого немов перебувають у',
        },
        { text: 'мрячка', stress: [2] },
        { text: 'сльота', stress: [5], shadeNote: 'невпинний дощ, мряка або мокрий сніг' },
      ],
      sources: [
        {
          title: 'Горох: синонімія (Цифрові лексикографічні системи української мови), «мжичка»',
          url: 'https://goroh.pp.ua/Синонімія/мжичка',
        },
      ],
    });
    const parsed = SynonymRowSchema.parse(row);
    expect(edition.checkNewSynonymRows([parsed])).toEqual([]);
    expect(readdirSync(join(dir, 'drafts'))).toEqual([`${draft?.id ?? ''}.json`]);
    expect(readFileSync(join(dir, 'review-report.md'), 'utf8')).toContain(
      `\`${draft?.id ?? ''}\` | мжичка |`,
    );
  });

  it('links a member that is a Lemma of the Edition to that Word by id', async () => {
    const { result, dir } = await run('мжичка\n', editionWith({ w_mrjaka: mrjaka }));

    const draft = lemmasOf(result)[0]?.drafts[0];
    expect(draft?.ready).toBe(true);
    expect(readDraft(dir, draft?.file ?? '')).toMatchObject({
      members: expect.arrayContaining([
        expect.objectContaining({ text: 'мряка', wordId: 'w_mrjaka' }),
      ]) as unknown,
    });
  });

  it('flags an unstressed member of several vowels and a row of 4 members, and keeps them incomplete', async () => {
    const { result } = await run('мжичка:2\n');

    const draft = lemmasOf(result)[0]?.drafts[0];
    expect(draft?.ready).toBe(false);
    expect(draft?.file).toMatch(/^incomplete\//);
    const kinds = draft?.flags.map((flag) => flag.kind);
    expect(kinds).toContain('stress-unresolved');
    expect(kinds).toContain('missing-data');
    expect(draft?.flags.find((flag) => flag.kind === 'missing-data')?.message).toMatch(/4 members/);
  });

  it('keeps a row of 13 members incomplete', async () => {
    const { result } = await run('косий:5\n');

    const draft = lemmasOf(result)[0]?.drafts[0];
    expect(draft?.ready).toBe(false);
    expect(draft?.flags).toContainEqual({
      kind: 'missing-data',
      message: expect.stringMatching(/13 members/) as string,
    });
  });

  it('refuses an article a language model wrote', async () => {
    const { result, dir } = await run('пасмо\n');

    const [lemma] = lemmasOf(result);
    expect(lemma?.drafts).toEqual([]);
    expect(lemma?.flags).toContainEqual({
      kind: 'no-entry',
      message: expect.stringMatching(/language model/) as string,
    });
    expect(readdirSync(join(dir, 'drafts'))).toEqual([]);
  });

  it('flags a dominant goroh has no row for', async () => {
    const { result } = await run('ніщо\n');

    expect(lemmasOf(result)[0]?.flags.map((flag) => flag.kind)).toEqual(['no-entry']);
  });

  it('puts a row the Edition already has in incomplete/', async () => {
    const existing = {
      id: 'r_exist1',
      dominant: { text: 'мжичка', stress: [2] },
      meaning: 'Дуже дрібний і густий дощ.',
      members: ['мжа', 'мжиця', 'мряка', 'мрячка', 'сльота'].map((text) => ({
        text,
        stress: [text === 'сльота' ? 5 : 2],
      })),
      sources: [{ title: 'Тестове джерело' }],
    };
    const { result } = await run('мжичка\n', editionWith({ r_exist1: existing }));

    const draft = lemmasOf(result)[0]?.drafts[0];
    expect(draft?.ready).toBe(false);
    expect(draft?.flags.map((flag) => flag.kind)).toEqual(['existing-entry']);
  });

  it('refuses a bad line before anything is fetched', async () => {
    const { result, requests } = await run('мжичка:0\nкосий:два\n');

    expect(result).toEqual({
      ok: false,
      errors: [
        expect.stringMatching(/^Line 1: .*sense number/) as string,
        expect.stringMatching(/^Line 2: .*sense number/) as string,
      ],
    });
    expect(requests).toEqual([]);
  });
});
