import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CorrectionSchema } from '@slovo/contracts';
import {
  EDITIONS_DIR,
  editionFiles,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

import { sourceCorrections, type CorrectionSourcingOptions, type Fetch } from './index';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const ukrainian = openEdition(EDITIONS_DIR, 'uk');
const USAGE = 'https://goroh.pp.ua/Слововживання/';

/** The saved «Слововживання» page of each form; any other goroh page is goroh's "not found". */
const savedPages: Record<string, string> = {
  співставляти: 'usage-spivstavljaty.html',
  вірно: 'usage-no-pair.html',
  згідно: 'usage-no-equivalent.html',
  самий: 'usage-language-model.html',
  прийшлось: 'usage-other-form.html',
};

function fakeNetwork() {
  const requests: string[] = [];
  const fetch: Fetch = (url) => {
    const address = decodeURI(url);
    requests.push(address);
    const saved = address.startsWith(USAGE) ? savedPages[address.slice(USAGE.length)] : undefined;
    return Promise.resolve(
      saved === undefined
        ? { status: 404, body: readFixture('not-found.html') }
        : { status: 200, body: readFixture(saved) },
    );
  };
  return { fetch, requests };
}

function readFixture(file: string): string {
  return readFileSync(join(fixturesDir, 'goroh', file), 'utf8');
}

/** A clock whose sleeps end at once, moving time on. */
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

/** A copy of the UA Edition's config with the given Corrections as its only content. */
function editionWith(corrections: Record<string, unknown> = {}): EditionFolder {
  const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  mkdirSync(join(editionsDir, 'uk'));
  writeFileSync(
    editionFiles(join(editionsDir, 'uk')).path('config'),
    readFileSync(ukrainian.path('config'), 'utf8'),
  );
  const edition = openEdition(editionsDir, 'uk');
  for (const [id, correction] of Object.entries(corrections)) {
    const file = join(edition.dir, edition.entryFile(id));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(correction));
  }
  return edition;
}

function setup(list: string, edition = editionWith()) {
  const net = fakeNetwork();
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-sourcing-'));
  const options: CorrectionSourcingOptions = {
    formList: list,
    edition,
    outDir: join(workDir, 'review'),
    cacheDir: join(workDir, 'cache'),
    fetch: net.fetch,
    clock: fakeClock(),
    random: Math.random,
  };
  return { options, net };
}

function readDrafts(outDir: string, folder: 'drafts' | 'incomplete'): unknown[] {
  const dir = join(outDir, 'corrections', folder);
  return readdirSync(dir).map(
    (name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown,
  );
}

async function run(list: string, edition?: EditionFolder) {
  const { options, net } = setup(list, edition);
  const result = await sourceCorrections(options);
  return { result, options, net };
}

describe('sourceCorrections', () => {
  it('drafts a ready Correction from a goroh article with an example pair, word for word and cited', async () => {
    const { result, options } = await run('співставляти calque school\n');

    expect(result.ok).toBe(true);
    expect(readDrafts(options.outDir, 'incomplete')).toEqual([]);
    const [draft, ...others] = readDrafts(options.outDir, 'drafts');
    expect(others).toEqual([]);
    const correction = CorrectionSchema.parse(draft);
    expect(correction).toMatchObject({
      id: expect.stringMatching(/^c_[a-z0-9]{6}$/) as string,
      nonStandardForm: 'співставляти',
      correctionType: 'calque',
      categoryId: 'school',
      standardEquivalents: ['зіставляти'],
      explanation:
        'Замініть скальковане дієслово співставляти на стилістично кращий варіант: зіставляти.',
      examplePair: {
        nonStandard: 'Співставте ці два поняття.',
        standard: 'Зіставте ці два поняття.',
      },
      sources: [
        {
          title: 'OnlineCorrector. Стилістичні помилки та помилки у слововживанні.',
          url: `${USAGE}співставляти`,
        },
      ],
    });
    // The Language Pack build's own checks accept it against the Edition.
    expect(ukrainian.checkNewCorrections([correction])).toEqual([]);
    expect(readFileSync(result.ok ? result.reportFile : '', 'utf8')).toContain('співставляти');
  });

  it.each([
    ['no example pair', 'вірно russianism conversation', /example pair/],
    ['no standard equivalent', 'згідно calque work', /standard equivalent/],
    ['an article about another form', 'прийшлось surzhyk conversation', /about/],
  ])('puts a draft with %s in incomplete, flagged missing-data', async (_name, line, message) => {
    const { result, options } = await run(`${line}\n`);

    expect(result.ok).toBe(true);
    expect(readDrafts(options.outDir, 'drafts')).toEqual([]);
    expect(readDrafts(options.outDir, 'incomplete')).toHaveLength(1);
    const [outcome] = result.ok ? result.report.lemmas : [];
    const [draft] = outcome?.drafts ?? [];
    expect(draft?.ready).toBe(false);
    expect(draft?.flags).toContainEqual({
      kind: 'missing-data',
      message: expect.stringMatching(message) as string,
    });
  });

  it('refuses an article a language model wrote: nothing of it is drafted', async () => {
    const { result, options } = await run('самий russianism conversation\n');

    expect(result.ok).toBe(true);
    expect(readDrafts(options.outDir, 'drafts')).toEqual([]);
    const incomplete = readDrafts(options.outDir, 'incomplete');
    expect(JSON.stringify(incomplete)).not.toContain('найбільш');
    const [outcome] = result.ok ? result.report.lemmas : [];
    expect(outcome?.flags).toContainEqual({
      kind: 'check',
      message: expect.stringMatching(/Велика мовна модель/) as string,
    });
  });

  it('puts a form the Edition already has in incomplete', async () => {
    const existing = JSON.parse(
      readFileSync(join(ukrainian.dir, ukrainian.entryFile('c_0bppof')), 'utf8'),
    ) as unknown;
    const { result, options } = await run(
      'співставляти calque school\n',
      editionWith({ c_0bppof: existing }),
    );

    expect(readDrafts(options.outDir, 'drafts')).toEqual([]);
    expect(readDrafts(options.outDir, 'incomplete')).toHaveLength(1);
    const [outcome] = result.ok ? result.report.lemmas : [];
    expect(outcome?.drafts[0]?.flags.map((flag) => flag.kind)).toContain('existing-entry');
  });

  it('reports a form goroh has no article for as no-entry', async () => {
    const { result } = await run('тимбільше surzhyk conversation\n');

    const [outcome] = result.ok ? result.report.lemmas : [];
    expect(outcome?.drafts).toEqual([]);
    expect(outcome?.flags.map((flag) => flag.kind)).toEqual(['no-entry']);
  });

  it('refuses an unknown Correction Type or Category by line, before anything is fetched', async () => {
    const { result, net } = await run(
      [
        '# forms',
        'співставляти calque school',
        'вірно mistake school',
        'згідно calque nowhere',
        'самий',
      ].join('\n'),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        'Line 3: Unknown Correction Type "mistake"',
        'Line 4: Unknown Category "nowhere"',
        'Line 5: Expected "<non-standard form> <correction type> <category id>"',
      ],
    });
    expect(net.requests).toEqual([]);
  });
});
