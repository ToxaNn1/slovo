import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CorrectionSchema, IdiomSchema } from '@slovo/contracts';
import {
  EDITIONS_DIR,
  editionFiles,
  openEdition,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

import { sourceIdioms, type Fetch, type IdiomSourcingOptions, type SourcingResult } from './index';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const ukrainian = openEdition(EDITIONS_DIR, 'uk');
const ukrainianConfigFile = ukrainian.path('config');
const PHRASEOLOGY = 'https://goroh.pp.ua/Фразеологія/';
const EFIMOVA = "Словник прислів'їв та приказок з поясненнями. / Єфімова І. В., 2011";

/**
 * Real goroh «Фразеологія» pages: лити and борона cite a dictionary, Дніпро a
 * language model. Any other goroh address answers with goroh's "not found" page.
 */
const savedPages: Record<string, string> = {
  [`${PHRASEOLOGY}лити`]: 'goroh/phraseology-lyty.html',
  [`${PHRASEOLOGY}борона`]: 'goroh/phraseology-borona.html',
  [`${PHRASEOLOGY}Дніпро`]: 'goroh/phraseology-dnipro.html',
};

function readFixture(file: string): string {
  return readFileSync(join(fixturesDir, file), 'utf8');
}

const fakeFetch: Fetch = (url) => {
  const saved = savedPages[decodeURI(url)];
  return Promise.resolve(
    saved === undefined
      ? { status: 404, body: readFixture('goroh/not-found.html') }
      : { status: 200, body: readFixture(saved) },
  );
};

/** A virtual clock: a sleep ends at once and moves time on. */
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

function seededRandom(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** The UA Edition's config with the given Idioms as its only content. */
function editionWith(idioms: Record<string, unknown> = {}): EditionFolder {
  const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  mkdirSync(join(editionsDir, 'uk'));
  writeFileSync(
    editionFiles(join(editionsDir, 'uk')).path('config'),
    readFileSync(ukrainianConfigFile, 'utf8'),
  );
  const edition = openEdition(editionsDir, 'uk');
  for (const [id, idiom] of Object.entries(idioms)) {
    const file = join(edition.dir, edition.entryFile(id));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(idiom));
  }
  return edition;
}

function run(idiomList: string, overrides: Partial<IdiomSourcingOptions> = {}) {
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-sourcing-'));
  const options: IdiomSourcingOptions = {
    idiomList,
    edition: editionWith(),
    outDir: join(workDir, 'review'),
    cacheDir: join(workDir, 'cache'),
    fetch: fakeFetch,
    clock: fakeClock(),
    random: seededRandom(),
    ...overrides,
  };
  return { outDir: options.outDir, result: sourceIdioms(options) };
}

function readDrafts(outDir: string, folder: 'drafts' | 'incomplete'): Record<string, unknown>[] {
  const dir = join(outDir, 'idioms', folder);
  return readdirSync(dir).map(
    (name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>,
  );
}

function draftOf(outDir: string, expression: string): Record<string, unknown> | undefined {
  return [...readDrafts(outDir, 'drafts'), ...readDrafts(outDir, 'incomplete')].find(
    (draft) => draft['expression'] === expression,
  );
}

function ok(result: SourcingResult) {
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result;
}

describe('sourceIdioms', () => {
  it('drafts one Idiom per phraseologism of the page, citing the dictionary goroh names', async () => {
    const { outDir, result } = run('лити\n');
    const { report } = ok(await result);

    expect(report.lemmas.map(({ lemma, drafts }) => [lemma, drafts.length])).toEqual([
      ['лити', 14],
    ]);
    expect(draftOf(outDir, 'Лити воду')).toEqual({
      id: expect.stringMatching(/^i_[a-z0-9]{6}$/) as string,
      expression: 'Лити воду',
      idiomType: 'idiom',
      primaryDefinition:
        'Говорити або писати неконкретно, беззмістовно, нецікаво і т. ін.; вести розмови замість того, щоб робити що-небудь.',
      examples: [
        {
          text: 'Сподіваюся, що в новому році письменники будуть менше “лити воду”, а більше писати.',
        },
      ],
      sources: [{ title: EFIMOVA, url: `${PHRASEOLOGY}лити` }],
    });
  });

  it('keeps further meanings as extra Definitions and Examples with their authors', async () => {
    const { outDir, result } = run('лити\n');
    ok(await result);

    const draft = draftOf(
      outDir,
      'Лити (проливати) / пролити [кривавий (солоний, сьомий і т. ін.)] піт',
    );

    expect(draft?.['primaryDefinition']).toBe(
      'Виконувати важку, складну роботу, докладаючи великих зусиль; надриватися, перевтомлюватися.',
    );
    expect(draft?.['extraDefinitions']).toEqual(['Вкладати в що-небудь свою працю.']);
    expect(draft?.['examples']).toEqual([
      { text: "Бідний піт ллє, а багатий його кров п'є." },
      {
        text: 'Все віддай на вжиток люду, Що, ллючи кривавий піт, Не жалів для тебе труду.',
        author: 'П. Грабовський',
      },
      {
        text: 'Вранці вийшли на роботу .. І не стидались лити поту На лоні братньої землі.',
        author: 'О. Олесь',
      },
      {
        text: 'Піт солоний пролива [перекладач] – Ну й попалися слова! Аж розпухла голова...',
        author: 'О. Ющенко',
      },
      {
        text: 'Груша росте собі.., а на виноградниках людині треба пролити сьомий піт.',
        author: 'М. Томчаній',
      },
      {
        text: 'Честь тому, хто в землю чорну В спеку, в холод піт свій ллє!',
        author: 'П. Грабовський',
      },
    ]);
  });

  it('gives every draft the Idiom Type of its line', async () => {
    const { result } = run('лити proverb\nборона idiom\n');
    const { report } = ok(await result);

    expect(report.lemmas.map(({ drafts }) => new Set(drafts.map((d) => d.summary.group)))).toEqual([
      new Set(['proverb']),
      new Set(['idiom']),
    ]);
  });

  it('calls ready only the drafts that pass the schema and the build’s checks', async () => {
    const { outDir, result } = run('лити\nборона\n');
    const { report } = ok(await result);
    const edition = editionWith();

    const ready = readDrafts(outDir, 'drafts');
    expect(ready.map((draft) => draft['expression'])).toEqual(
      expect.arrayContaining([
        'Лити воду',
        "Ранні пташки росу п'ють, а пізні слізки ллють",
        'Ти його борони від собак, а він тобі покаже кулак',
      ]) as unknown,
    );
    expect(ready.flatMap((draft) => edition.checkNewIdioms([IdiomSchema.parse(draft)]))).toEqual(
      [],
    );
    const incomplete = report.lemmas.flatMap(({ drafts }) => drafts.filter((d) => !d.ready));
    expect(incomplete.length).toBeGreaterThan(0);
    expect(incomplete.every(({ issues }) => issues.some((i) => i.startsWith('expression:')))).toBe(
      true,
    );
  });

  it('refuses a page goroh attributes to a language model', async () => {
    const { result } = run('Дніпро\n');
    const { report } = ok(await result);

    const [outcome] = report.lemmas;
    expect(outcome?.drafts).toEqual([]);
    expect(outcome?.flags).toEqual([
      { kind: 'check', message: expect.stringMatching(/language model/) as string },
    ]);
  });

  it('flags a Lemma goroh has no «Фразеологія» page for as no-entry', async () => {
    const { result } = run('ябвгд\n');
    const { report } = ok(await result);

    expect(report.lemmas[0]?.flags.map((flag) => flag.kind)).toEqual(['no-entry']);
  });

  it('sends an expression the Edition already has to incomplete', async () => {
    const edition = editionWith({
      i_old001: {
        id: 'i_old001',
        expression: 'лити воду',
        idiomType: 'idiom',
        primaryDefinition: 'Говорити беззмістовно.',
        sources: [{ title: 'Словник', url: 'https://example.org/voda' }],
      },
    });
    const { result } = run('лити\n', { edition });
    const { report } = ok(await result);

    const draft = report.lemmas[0]?.drafts.find(({ summary }) => summary.text === 'Лити воду');
    expect(draft?.ready).toBe(false);
    expect(draft?.flags.map((flag) => flag.kind)).toContain('existing-entry');
  });

  it('sends an expression an Entry of another kind has to incomplete', async () => {
    const correction = JSON.parse(
      readFileSync(join(ukrainian.dir, ukrainian.entryFile('c_0bppof')), 'utf8'),
    ) as unknown;
    const edition = editionWith({
      c_0bppof: { ...CorrectionSchema.parse(correction), nonStandardForm: 'лити воду' },
    });
    const { result } = run('лити\n', { edition });
    const { report } = ok(await result);

    const draft = report.lemmas[0]?.drafts.find(({ summary }) => summary.text === 'Лити воду');
    expect(draft?.ready).toBe(false);
    expect(draft?.flags).toContainEqual({
      kind: 'existing-entry',
      message: '"Лити воду" is already a Correction of the Edition: c_0bppof',
    });
  });

  it('keeps one ready draft of an expression two pages of the run list', async () => {
    const { outDir, result } = run('лити\nлляти\n', {
      fetch: (url, fetchOptions) =>
        fakeFetch(
          decodeURI(url) === `${PHRASEOLOGY}лляти` ? encodeURI(`${PHRASEOLOGY}лити`) : url,
          fetchOptions,
        ),
    });
    const { report } = ok(await result);

    const [first, second] = report.lemmas;
    const firstReady = first?.drafts.filter(({ ready }) => ready) ?? [];
    expect(firstReady.length).toBeGreaterThan(0);
    expect(second?.drafts.filter(({ ready }) => ready)).toEqual([]);
    const repeat = second?.drafts.find(({ summary }) => summary.text === 'Лити воду');
    const original = firstReady.find(({ summary }) => summary.text === 'Лити воду');
    expect(repeat?.flags).toContainEqual({
      kind: 'existing-entry',
      message: `"Лити воду" is already drafted in this run: ${original?.id ?? ''}`,
    });
    expect(readDrafts(outDir, 'drafts')).toHaveLength(firstReady.length);
  });

  it('flags a page that cannot be fetched', async () => {
    const { result } = run('лити\n', {
      fetch: () => Promise.reject(new TypeError('fetch failed: ECONNREFUSED')),
    });
    const { report } = ok(await result);

    expect(report.lemmas[0]?.flags.map((flag) => flag.kind)).toEqual(['fetch-failed']);
  });

  it('refuses a list with a bad line before anything is fetched', async () => {
    let fetched = 0;
    const { result } = run('лити saying\nбо́рона\nкури proverb extra\n', {
      fetch: (url, fetchOptions) => {
        fetched += 1;
        return fakeFetch(url, fetchOptions);
      },
    });

    expect(await result).toEqual({
      ok: false,
      errors: [
        expect.stringMatching(/^Line 1: .*"saying"/) as string,
        expect.stringMatching(/^Line 2: .*without stress marks/) as string,
        expect.stringMatching(/^Line 3: Expected "<lemma> \[idiom\|proverb\]"/) as string,
      ],
    });
    expect(fetched).toBe(0);
  });
});
