import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readSnapshotFile } from '@slovo/language-pack';
import {
  EDITIONS_DIR,
  editionFiles,
  openEditionWithSnapshot,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import { PoliteClient } from '@slovo/sourcing';

import { verifyEntries } from './verify';

const toolDir = fileURLToPath(new URL('../', import.meta.url));
/** The UA Edition's seed snapshot: the records every run starts from. */
const SEED_FILE = join(EDITIONS_DIR, 'uk', 'seed-snapshot.json');
const seedSnapshot = readSnapshotFile(SEED_FILE);
const ukrainian = openEditionWithSnapshot(EDITIONS_DIR, 'uk', seedSnapshot);
const categoryId = ukrainian.config.categories[0]?.id ?? '';

const GOROH = 'https://goroh.pp.ua/Тлумачення/';
const LANGUAGE_MODEL = 'Велика мовна модель: GPT';
const SUM = 'Тлумачний словник української мови в 11 томах';

/** A goroh page with one article block per [dictionary, text]. */
function gorohPage(...blocks: [string, string][]): string {
  const articles = blocks.map(
    ([dictionary, text]) =>
      `<div class="article-block"><h2><span class="uppercase">слово</span></h2>` +
      `<div class="article-body">${text}</div><div class="source-info">${dictionary}</div></div>`,
  );
  return `<html><body>${articles.join('\n')}</body></html>`;
}

function word(id: string, primaryDefinition: string, url?: string) {
  return {
    kind: 'word',
    id,
    lemma: `перевірка${id.slice(-3)}`,
    stress: [1],
    partOfSpeech: 'noun',
    gender: 'feminine',
    primaryDefinition,
    categoryId,
    rarity: 3,
    sources: [{ title: 'СУМ-11', ...(url === undefined ? {} : { url }) }],
  };
}

// Runs start where the test says, not where pnpm started.
const { INIT_CWD: _initCwd, ...withoutInitCwd } = process.env;

let workDir: string;
let editionDir: string;
let cacheDir: string;
/** The Words written over the seed snapshot's, by id. */
let words: Map<string, { id: string }>;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-verify-'));
  editionDir = join(workDir, 'editions', 'uk');
  cacheDir = join(workDir, 'cache');
  words = new Map();
  mkdirSync(editionDir, { recursive: true });
  writeFileSync(
    editionFiles(editionDir).path('config'),
    readFileSync(ukrainian.path('config'), 'utf8'),
  );
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Saves pages in the cache folder the sourcing tool shares, as a fetch would have. */
async function seed(pages: Record<string, { status?: number; body: string }>) {
  const client = new PoliteClient(
    (url) => {
      const page = Object.entries(pages).find(([address]) => encodeURI(address) === url)?.[1];
      return Promise.resolve({ status: page?.status ?? 200, body: page?.body ?? '' });
    },
    { now: () => 0, sleep: () => Promise.resolve() },
    cacheDir,
    0,
  );
  for (const address of Object.keys(pages)) await client.get(encodeURI(address));
}

/** Writes a Word into the snapshot the next run reads; gives what the run names it. */
function writeEntry(entry: { id: string }): string {
  words.set(entry.id, entry);
  return `snapshot:word/${entry.id}`;
}

/** The id of the record a run names `snapshot:<kind>/<id>`. */
function id(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

/** Saves the seed snapshot with the written Words over it; gives its file. */
function saveSnapshot(name = 'snapshot.json'): string {
  const file = join(workDir, name);
  const kept = seedSnapshot.words.filter(({ id }) => !words.has(id));
  writeFileSync(file, JSON.stringify({ ...seedSnapshot, words: [...kept, ...words.values()] }));
  return file;
}

/** The Edition of the copy, its records from the saved snapshot. */
function edition(): EditionFolder {
  return openEditionWithSnapshot(join(workDir, 'editions'), 'uk', readSnapshotFile(saveSnapshot()));
}

/** Runs `pnpm content verify` over the copy; nothing may reach the network. */
function verify(args: string[], cwd = editionDir, { snapshot = true } = {}) {
  const run = spawnSync(
    join(toolDir, 'node_modules/.bin/tsx'),
    [
      '--disable-warning=ExperimentalWarning',
      join(toolDir, 'src/cli.ts'),
      'verify',
      ...args,
      '--edition',
      'uk',
      ...(snapshot ? ['--snapshot', saveSnapshot()] : []),
      '--cache',
      cacheDir,
    ],
    {
      cwd,
      encoding: 'utf8',
      env: {
        ...withoutInitCwd,
        SLOVO_EDITIONS_DIR: join(workDir, 'editions'),
        SLOVO_API_URL: '',
      },
    },
  );
  const lines = run.stdout.split('\n').filter((line) => line !== '');
  return { status: run.status, lines, stderr: run.stderr };
}

const definition = 'Те, що перевіряють у словнику, — з усіма подробицями «так».';

describe('verify', () => {
  it('passes an Entry whose quote is in a dictionary block of its goroh page', async () => {
    await seed({ [`${GOROH}перевірка001`]: { body: gorohPage([SUM, definition]) } });
    const file = writeEntry(word('w_vrf001', definition, `${GOROH}перевірка001`));

    const run = verify([id(file)]);

    expect(run.lines).toEqual([`ok\tw_vrf001\t${file}`, '1 ok']);
    expect(run.status).toBe(0);
  });

  it('passes a quote without the homonym index the page sets after a word', async () => {
    const page = 'Лютий <i>(див.</i> <a href="/Тлумачення/лютий">лю́тий</a><sup>2</sup>).';
    await seed({ [`${GOROH}перевірка003`]: { body: gorohPage([SUM, page]) } });
    const file = writeEntry(word('w_vrf003', 'Лютий (див. лю́тий).', `${GOROH}перевірка003`));

    const run = verify([id(file)]);

    expect(run.lines).toEqual([`ok\tw_vrf003\t${file}`, '1 ok']);
    expect(run.status).toBe(0);
  });

  it('reports a miss when a word of the quote differs from the page', async () => {
    await seed({ [`${GOROH}перевірка002`]: { body: gorohPage([SUM, definition]) } });
    const changed = definition.replace('словнику', 'довіднику');
    const file = writeEntry(word('w_vrf002', changed, `${GOROH}перевірка002`));

    const run = verify([id(file)]);

    expect(run.lines[0]).toMatch(new RegExp(`^miss\tw_vrf002\t${file}\t.*довіднику`));
    expect(run.lines.at(-1)).toBe('1 miss');
    expect(run.status).toBe(1);
  });

  it('refuses a quote that only a language-model block of the page holds', async () => {
    await seed({
      [`${GOROH}перевірка003`]: {
        body: gorohPage([SUM, 'Інше значення.'], [LANGUAGE_MODEL, definition]),
      },
    });
    const file = writeEntry(word('w_vrf003', definition, `${GOROH}перевірка003`));

    const run = verify([id(file)]);

    expect(run.lines).toEqual([`llm\tw_vrf003\t${file}`, '1 llm']);
    expect(run.status).toBe(1);
  });

  it("reads another site's page as its plain text", async () => {
    const url = 'https://example.org/словник/перевірка';
    await seed({
      [url]: {
        body: '<p>Те, що перевіряють у <b>словнику</b>, &mdash; з усіма подробицями &laquo;так&raquo;.</p>',
      },
    });
    const file = writeEntry(word('w_vrf004', definition, url));

    expect(verify([id(file)]).lines).toEqual([`ok\tw_vrf004\t${file}`, '1 ok']);
  });

  it('fails an Entry whose page could not be fetched, and asks again on a re-run', async () => {
    const file = writeEntry(word('w_vrf005', definition, `${GOROH}перевірка005`));
    const answers = [
      { status: 404, body: 'Not found' },
      { status: 200, body: gorohPage([SUM, definition]) },
    ];
    const run = async () => {
      const lines: string[] = [];
      const status = await verifyEntries({
        edition: edition(),
        targets: { kind: 'named', names: ['w_vrf005'] },
        bookFile: undefined,
        client: new PoliteClient(
          () => Promise.resolve(answers.shift() ?? { status: 500, body: '' }),
          { now: () => 0, sleep: () => Promise.resolve() },
          cacheDir,
          0,
        ),
        cwd: editionDir,
        print: (line) => lines.push(line),
        problem: (line) => lines.push(line),
      });
      return { status, lines };
    };

    expect(await run()).toEqual({
      status: 1,
      lines: [`fetch-failed\tw_vrf005\t${file}\tHTTP 404`, '1 fetch-failed'],
    });
    expect(await run()).toEqual({ status: 0, lines: [`ok\tw_vrf005\t${file}`, '1 ok'] });
  });

  it('picks Entries by id', async () => {
    await seed({ [`${GOROH}перевірка001`]: { body: gorohPage([SUM, definition]) } });
    const file = writeEntry(word('w_vrf001', definition, `${GOROH}перевірка001`));

    expect(verify(['w_vrf001']).lines).toEqual([`ok\tw_vrf001\t${file}`, '1 ok']);
  });

  it('verifies the drafts of a folder, each as an Entry', async () => {
    const drafts = join(workDir, 'review', 'words', 'drafts');
    mkdirSync(drafts, { recursive: true });
    const draft = (entry: { id: string }) => {
      writeFileSync(join(drafts, `${entry.id}.json`), JSON.stringify(entry, null, 2));
      return join('review', 'words', 'drafts', `${entry.id}.json`);
    };
    await seed({
      [`${GOROH}перевірка006`]: { body: gorohPage([SUM, definition]) },
      [`${GOROH}перевірка007`]: { body: gorohPage([SUM, definition]) },
    });
    const passing = draft(word('w_vrf006', definition, `${GOROH}перевірка006`));
    const missing = draft(
      word('w_vrf007', definition.replace('словнику', 'довіднику'), `${GOROH}перевірка007`),
    );

    const run = verify([join('review', 'words', 'drafts')], workDir);

    expect(run.lines[0]).toBe(`ok\tw_vrf006\t${passing}`);
    expect(run.lines[1]).toMatch(new RegExp(`^miss\tw_vrf007\t${missing}\t.*довіднику`));
    expect(run.lines.at(-1)).toBe('1 ok, 1 miss');
    expect(run.status).toBe(1);
  });

  it('verifies one draft file', async () => {
    await seed({ [`${GOROH}перевірка008`]: { body: gorohPage([SUM, definition]) } });
    writeFileSync(
      join(workDir, 'w_vrf008.json'),
      JSON.stringify(word('w_vrf008', definition, `${GOROH}перевірка008`)),
    );

    const run = verify(['w_vrf008.json'], workDir);

    expect(run.lines).toEqual(['ok\tw_vrf008\tw_vrf008.json', '1 ok']);
    expect(run.status).toBe(0);
  });

  it('verifies drafts alone from the Edition config, with no snapshot', async () => {
    await seed({ [`${GOROH}перевірка009`]: { body: gorohPage([SUM, definition]) } });
    writeFileSync(
      join(workDir, 'w_vrf009.json'),
      JSON.stringify(word('w_vrf009', definition, `${GOROH}перевірка009`)),
    );

    const run = verify(['w_vrf009.json'], workDir, { snapshot: false });

    expect(run.lines).toEqual(['ok\tw_vrf009\tw_vrf009.json', '1 ok']);
    expect(run.status).toBe(0);
  });

  it('refuses a draft that is no record of its kind', () => {
    writeFileSync(join(workDir, 'w_vrf009.json'), JSON.stringify({ id: 'w_vrf009' }));
    writeFileSync(join(workDir, 'nokind.json'), JSON.stringify({ lemma: 'слово' }));

    const run = verify(['w_vrf009.json', 'nokind.json'], workDir);

    expect(run.stderr).toContain('w_vrf009.json');
    expect(run.stderr).toContain('nokind.json');
    expect(run.lines).toEqual([]);
    expect(run.status).toBe(2);
  });

  it('refuses a name that is no Entry of the Edition', () => {
    const run = verify(['w_nothere']);

    expect(run.stderr).toContain('w_nothere');
    expect(run.status).toBe(2);
  });

  describe('a book source', () => {
    // A Tip sourced from the book alone: a source with a url is fetched, not left unverified.
    const tip = ukrainian
      .entries()
      .tips.find(({ entry }) => entry.sources.every((source) => source.url === undefined));
    if (tip === undefined) throw new Error('The UA Edition has no Tip sourced from a book alone');
    const { entry } = tip;
    const quoted = [
      entry.title,
      entry.nonStandardForm,
      entry.standardForm,
      entry.example?.text,
      entry.gameQuestion.rightAnswer,
    ].filter((text) => text !== undefined);

    it('leaves an Entry without a page unverified without failing', () => {
      const run = verify([entry.id]);

      expect(run.lines).toEqual([`unverified\t${entry.id}\t${tip.file}`, '1 unverified']);
      expect(run.status).toBe(0);
    });

    it('verifies every quoted field of a Tip against the book and prints the page', () => {
      const book = join(workDir, 'book.txt');
      writeFileSync(
        book,
        [`11\tВступ.`, ...quoted.map((text) => `11\t${text}`), `12\t${entry.explanation}`].join(
          '\n',
        ),
      );

      const run = verify([entry.id, '--book', book]);

      expect(run.lines).toEqual([`ok\t${entry.id}\t${tip.file}\tpage 12`, '1 ok']);
      expect(run.status).toBe(0);
    });

    it('fails an Entry the book does not verify either', () => {
      const book = join(workDir, 'book.txt');
      writeFileSync(book, `12\t${entry.explanation}`);

      const run = verify([entry.id, '--book', book]);

      expect(run.lines[0]).toMatch(new RegExp(`^unverified\t${entry.id}\t.*title`));
      expect(run.lines.at(-1)).toBe('1 unverified');
      expect(run.status).toBe(1);
    });
  });

  it('with --changed, verifies only the Entries whose quote differs from the earlier snapshot', async () => {
    const earlier = saveSnapshot('earlier.json');
    const existing = ukrainian.entries().words[0];
    if (existing === undefined) throw new Error('The UA Edition has no Word');
    const url = existing.entry.sources[0]?.url ?? '';
    await seed({
      [url]: { body: gorohPage([SUM, definition]) },
      [`${GOROH}перевірка001`]: { body: gorohPage([SUM, definition]) },
    });
    const changedWord = { ...existing.entry, primaryDefinition: definition };
    const changed = writeEntry(changedWord);
    const added = writeEntry(word('w_vrf001', definition, `${GOROH}перевірка001`));

    const run = verify(['--changed', earlier]);

    expect(run.lines.toSorted()).toEqual(
      [`ok\t${existing.entry.id}\t${changed}`, `ok\tw_vrf001\t${added}`, '2 ok'].toSorted(),
    );
    const now = saveSnapshot('now.json');
    expect(verify(['--changed', now]).lines).toEqual([`No Entry differs from ${now}`]);
  });

  it('fails loudly, never verifying nothing, when no snapshot is given', () => {
    const run = spawnSync(
      join(toolDir, 'node_modules/.bin/tsx'),
      [
        '--disable-warning=ExperimentalWarning',
        join(toolDir, 'src/cli.ts'),
        'verify',
        'w_x',
        '--edition',
        'uk',
      ],
      { cwd: workDir, encoding: 'utf8', env: { ...withoutInitCwd, SLOVO_API_URL: '' } },
    );

    expect(run.stderr).toContain('--snapshot <file>');
    expect(run.status).toBe(2);
  });
});
