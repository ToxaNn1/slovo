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
import { seededRandom } from './test-support';

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

/** Goroh as saved, with `pages` (form → page) served in place of the saved ones. */
function fakeNetwork(pages: Record<string, string> = {}) {
  const requests: string[] = [];
  const fetch: Fetch = (url) => {
    const address = decodeURI(url);
    requests.push(address);
    const form = address.startsWith(USAGE) ? address.slice(USAGE.length) : '';
    const saved = savedPages[form];
    const body = pages[form] ?? (saved === undefined ? undefined : readFixture(saved));
    return Promise.resolve(
      body === undefined
        ? { status: 404, body: readFixture('not-found.html') }
        : { status: 200, body },
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

function setup(list: string, edition = editionWith(), pages: Record<string, string> = {}) {
  const net = fakeNetwork(pages);
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-sourcing-'));
  const options: CorrectionSourcingOptions = {
    formList: list,
    edition,
    outDir: join(workDir, 'review'),
    cacheDir: join(workDir, 'cache'),
    fetch: net.fetch,
    clock: fakeClock(),
    random: seededRandom(),
  };
  return { options, net };
}

function readDrafts(outDir: string, folder: 'drafts' | 'incomplete'): unknown[] {
  const dir = join(outDir, 'corrections', folder);
  return readdirSync(dir).map(
    (name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown,
  );
}

async function run(list: string, edition?: EditionFolder, pages?: Record<string, string>) {
  const { options, net } = setup(list, edition, pages);
  const result = await sourceCorrections(options);
  return { result, options, net };
}

/** The saved «співставляти» page with its example pair replaced by the given sentences. */
function pageWithPair(nonStandard: string, standard: string): Record<string, string> {
  const page = readFixture('usage-spivstavljaty.html')
    .replace(/<td><em><span style="color: #ff0000;">.*<\/td>/, `<td>${nonStandard}</td>`)
    .replace(/<td><em><span style="color: #008000;">.*<\/td>/, `<td>${standard}</td>`);
  return { співставляти: page };
}

async function draftedPair(nonStandard: string, standard: string) {
  const { options } = await run(
    'співставляти calque school\n',
    undefined,
    pageWithPair(nonStandard, standard),
  );
  const [draft] = [
    ...readDrafts(options.outDir, 'drafts'),
    ...readDrafts(options.outDir, 'incomplete'),
  ];
  return draft;
}

describe('sourceCorrections', () => {
  it('marks only the changed words of the standard sentence, in parts, without their punctuation', async () => {
    expect(
      await draftedPair('Прийміть наші поради до відома.', 'Візьміть наші поради до уваги.'),
    ).toMatchObject({
      examplePair: {
        nonStandard: 'Прийміть наші поради до відома.',
        standard: '**Візьміть** наші поради до **уваги**.',
      },
    });
  });

  it('treats words differing only in Stress as unchanged', async () => {
    expect(
      await draftedPair('Співста́вте ці два поняття.', 'Зіста́вте ці два поняття́.'),
    ).toMatchObject({ examplePair: { standard: '**Зіста́вте** ці два поняття́.' } });
  });

  it('leaves out an example pair whose sentences do not differ, and says so', async () => {
    const { result, options } = await run(
      'співставляти calque school\n',
      undefined,
      pageWithPair('Зіставте ці два поняття.', 'Зіставте ці два поняття.'),
    );
    expect(readDrafts(options.outDir, 'drafts')).toEqual([]);
    const [entry] = readDrafts(options.outDir, 'incomplete');
    expect(entry).not.toHaveProperty('examplePair');
    const [outcome] = result.ok ? result.report.lemmas : [];
    expect(outcome?.drafts[0]?.flags).toContainEqual({
      kind: 'missing-data',
      message: 'the example pair changes no word',
    });
  });

  it('drafts a ready Correction from a goroh article with an example pair, word for word and cited', async () => {
    const { result, options } = await run('співставляти calque school\n');

    expect(result.ok).toBe(true);
    expect(readDrafts(options.outDir, 'incomplete')).toEqual([]);
    const [draft, ...others] = readDrafts(options.outDir, 'drafts');
    expect(others).toEqual([]);
    const correction = CorrectionSchema.parse(draft);
    expect(correction).toMatchObject({
      id: 'c_vkt9yt',
      nonStandardForm: 'співставляти',
      correctionType: 'calque',
      categoryId: 'school',
      standardEquivalents: ['зіставляти'],
      explanation:
        'Замініть скальковане дієслово співставляти на стилістично кращий варіант: зіставляти.',
      examplePair: {
        nonStandard: 'Співставте ці два поняття.',
        standard: '**Зіставте** ці два поняття.',
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
