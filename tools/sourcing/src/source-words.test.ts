import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WordSchema } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  sourceWords,
  type Fetch,
  type Flag,
  type LemmaOutcome,
  type SourcingOptions,
  type SourcingResult,
} from './index';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const ukrainianEditionDir = fileURLToPath(new URL('../../../editions/uk/', import.meta.url));

const CDX = 'https://web.archive.org/cdx/search/cdx?url=sum.in.ua/s/';
const CDX_FIELDS = '&filter=statuscode:200&fl=timestamp,original';
const GOROH = 'https://goroh.pp.ua/';

/** Where each saved page was fetched from, keyed by its decoded address. */
const savedPages: Record<string, { status: number; file: string }> = {
  ...savedLemma('мжичка', 'mzhychka', '20241216072945', 'https://sum.in.ua/s/mzhychka'),
  ...savedLemma('коса', 'kosa', '20260106131627', 'https://sum.in.ua/s/kosa'),
  ...savedLemma('ножиці', 'nozhyci', '20231105060742', 'http://sum.in.ua/s/nozhyci', {
    synonyms: false,
  }),
  ...savedLemma('завжди', 'zavzhdy', '20230903211240', 'http://sum.in.ua/s/zavzhdy'),
  // goroh «Тлумачення» pages: СУМ-20 for дратва, коса and ножиці, СУМ-11 for ятір.
  [`${GOROH}Тлумачення/дратва`]: { status: 200, file: 'goroh/definitions-dratva.html' },
  [`${GOROH}Тлумачення/коса`]: { status: 200, file: 'goroh/definitions-kosa.html' },
  [`${GOROH}Тлумачення/ножиці`]: { status: 200, file: 'goroh/definitions-nozhyci.html' },
  [`${GOROH}Тлумачення/ятір`]: { status: 200, file: 'goroh/definitions-jatir.html' },
  [`${GOROH}Словозміна/ятір`]: { status: 200, file: 'goroh/inflection-jatir.html' },
  // СУМ-11 for товмач, whose labels goroh prints as plain text; СУМ-20 for плесо.
  [`${GOROH}Тлумачення/товмач`]: { status: 200, file: 'goroh/definitions-tovmach.html' },
  [`${GOROH}Словозміна/товмач`]: { status: 200, file: 'goroh/inflection-tovmach.html' },
  [`${GOROH}Тлумачення/плесо`]: { status: 200, file: 'goroh/definitions-pleso.html' },
  // A verb whose endings give the plural form: «влю, виш; мн. гарка́влять; недок.».
  [`${GOROH}Тлумачення/гаркавити`]: { status: 200, file: 'goroh/definitions-harkavyty.html' },
};

function savedLemma(
  lemma: string,
  slug: string,
  timestamp: string,
  original: string,
  { synonyms = true } = {},
): typeof savedPages {
  return {
    [`${CDX}${slug}${CDX_FIELDS}`]: { status: 200, file: `wayback/cdx-${slug}.txt` },
    [`https://web.archive.org/web/${timestamp}id_/${original}`]: {
      status: 200,
      file: `sum/${slug}.html`,
    },
    [`${GOROH}Словозміна/${lemma}`]: { status: 200, file: `goroh/inflection-${slug}.html` },
    [`${GOROH}Синонімія/${lemma}`]: synonyms
      ? { status: 200, file: `goroh/synonyms-${slug}.html` }
      : { status: 404, file: 'goroh/not-found.html' },
    [`${GOROH}Етимологія/${lemma}`]: { status: 200, file: `goroh/etymology-${slug}.html` },
  };
}

interface NetworkOptions {
  /** Pages sum.in.ua serves directly; without any, the site doesn't answer. */
  readonly sumReachable?: Record<string, string>;
  /** goroh has no entries at all. */
  readonly gorohEmpty?: boolean;
  /** goroh has no «Тлумачення» pages, so Definitions come from sum.in.ua. */
  readonly withoutGorohDefinitions?: boolean;
  /** The Wayback Machine refuses connections. */
  readonly waybackDown?: boolean;
  /** Addresses answered with this status, that many times, before the real page. */
  readonly rateLimited?: Record<string, { status: number; times: number }>;
}

interface FakeNetwork {
  readonly fetch: Fetch;
  /** The decoded address of every request that reached the network, in order. */
  readonly requests: string[];
  /** The fake clock's reading at each request, in milliseconds. */
  readonly requestTimes: number[];
}

/**
 * The saved pages stand in for the sites. Any other goroh address answers with
 * goroh's real "not found" page, the Wayback Machine has no copy of it, and
 * anything else fails like a dead host.
 */
function fakeNetwork(
  clock: { now: () => number },
  {
    sumReachable = {},
    gorohEmpty = false,
    withoutGorohDefinitions = false,
    waybackDown = false,
    rateLimited = {},
  }: NetworkOptions = {},
): FakeNetwork {
  const requests: string[] = [];
  const requestTimes: number[] = [];
  const limits = new Map(
    Object.entries(rateLimited).map(([address, limit]) => [address, { ...limit }]),
  );
  const fetch: Fetch = (url) => {
    const address = decodeURI(url);
    requests.push(address);
    requestTimes.push(clock.now());
    const limit = limits.get(address);
    if (limit !== undefined && limit.times > 0) {
      limit.times -= 1;
      return Promise.resolve({ status: limit.status, body: 'Too Many Requests' });
    }
    if (waybackDown && address.startsWith('https://web.archive.org/')) {
      return Promise.reject(new TypeError('fetch failed: ECONNREFUSED'));
    }
    const direct = sumReachable[address];
    if (direct !== undefined) return Promise.resolve({ status: 200, body: readFixture(direct) });
    const hidden =
      (gorohEmpty && address.startsWith(GOROH)) ||
      (withoutGorohDefinitions && address.startsWith(`${GOROH}Тлумачення/`));
    const saved = hidden ? undefined : savedPages[address];
    if (saved !== undefined) {
      return Promise.resolve({ status: saved.status, body: readFixture(saved.file) });
    }
    if (address.startsWith(GOROH)) {
      return Promise.resolve({ status: 404, body: readFixture('goroh/not-found.html') });
    }
    if (address.startsWith(CDX)) return Promise.resolve({ status: 200, body: '' });
    return Promise.reject(new TypeError(`fetch failed: ${address}`));
  };
  return { fetch, requests, requestTimes };
}

function readFixture(file: string): string {
  return readFileSync(join(fixturesDir, file), 'utf8');
}

/**
 * A virtual clock shared by every run in a test: a sleep ends when virtual
 * time reaches it, earliest first, so parallel runs interleave as they would
 * on a real machine.
 */
function fakeClock() {
  let time = 1_000_000;
  let order = 0;
  const timers: { at: number; order: number; wake: () => void }[] = [];
  const fireEarliest = () => {
    timers.sort((a, b) => a.at - b.at || a.order - b.order);
    const timer = timers.shift();
    if (timer === undefined) return;
    time = Math.max(time, timer.at);
    timer.wake();
  };
  return {
    now: () => time,
    sleep: (ms: number) =>
      new Promise<void>((wake) => {
        timers.push({ at: time + ms, order: (order += 1), wake });
        setImmediate(fireEarliest);
      }),
  };
}

/** A repeatable stand-in for Math.random. */
function seededRandom(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function setup(overrides: Partial<SourcingOptions> = {}, network?: NetworkOptions) {
  const clock = fakeClock();
  const net = fakeNetwork(clock, network);
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-sourcing-'));
  const options: SourcingOptions = {
    lemmaList: '',
    // The Ukrainian Edition's config with no Words, so its authored Words don't duplicate the drafts.
    editionDir: editionWith((config) => config),
    outDir: join(workDir, 'review'),
    cacheDir: join(workDir, 'cache'),
    fetch: net.fetch,
    clock,
    random: seededRandom(),
    ...overrides,
  };
  return { options, net, workDir, clock };
}

/** A copy of the Ukrainian Edition's config with the given edit, and the given Words as its content. */
function editionWith(
  edit: (config: Record<string, unknown>) => Record<string, unknown>,
  words: Record<string, unknown> = {},
  registry?: unknown,
): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-edition-'));
  const config = JSON.parse(
    readFileSync(join(ukrainianEditionDir, 'edition.json'), 'utf8'),
  ) as Record<string, unknown>;
  writeFileSync(join(dir, 'edition.json'), JSON.stringify(edit(config)));
  mkdirSync(join(dir, 'content', 'words'), { recursive: true });
  for (const [id, word] of Object.entries(words)) {
    writeFileSync(join(dir, 'content', 'words', `${id}.json`), JSON.stringify(word));
  }
  if (registry !== undefined) {
    writeFileSync(join(dir, 'content', 'ids.json'), JSON.stringify(registry));
  }
  return dir;
}

function readDrafts(outDir: string, folder = 'drafts'): unknown[] {
  const dir = join(outDir, folder);
  return readdirSync(dir)
    .sort()
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown);
}

describe('sourceWords', () => {
  it('drafts a Word from СУМ-11 through the Wayback Machine and from goroh', async () => {
    const { options } = setup({ lemmaList: 'мжичка nature-weather 2\n' });

    const result = await sourceWords(options);

    expect(result.ok).toBe(true);
    const [draft, ...others] = readDrafts(options.outDir);
    expect(others).toEqual([]);
    const word = WordSchema.parse(draft);
    expect(word).toMatchObject({
      lemma: 'мжичка',
      stress: [2],
      partOfSpeech: 'noun',
      gender: 'feminine',
      primaryDefinition:
        'Дуже дрібні краплі води, які насичують повітря; дрібний, густий дощ; мряка (у 1 знач.).',
      extraDefinitions: [],
      examples: [
        {
          text: 'Сірий осінній ранок куривсь дрібною мжичкою.',
          author: 'Михайло Коцюбинський',
        },
        {
          text: 'Дощ у цю хвилину майже припинився, сіялася лише мжичка, заснувавши дрібною сіткою далеку перспективу вулиці.',
          author: 'Юрій Смолич',
        },
        {
          text: 'Був густий туман, і якась уїдлива сиза мжичка запорошила одяг, інеєм осіла на чубах.',
          author: 'Василь Козаченко',
        },
      ],
      antonyms: [],
      registers: [],
      categoryId: 'nature-weather',
      rarity: 2,
    });
    expect(word.id).toMatch(/^w_[a-z0-9]{6}$/);
    expect(word.sources[0]).toEqual({
      title: 'Словник української мови: в 11 томах. — Том 4, 1973. — Стор. 698.',
      url: 'https://sum.in.ua/s/mzhychka',
      archivedUrl: 'https://web.archive.org/web/20241216072945/https://sum.in.ua/s/mzhychka',
    });
  });

  it('takes Synonyms only from synonym dictionaries and the etymology from ЕСУМ', async () => {
    const { options } = setup({ lemmaList: 'завжди language-speech 1\n' });

    const result = await sourceWords(options);

    const [draft] = readDrafts(options.outDir);
    const word = WordSchema.parse(draft);
    expect(word.synonyms).toContain('повсякчас');
    expect(word.synonyms).toContain('завше');
    // «Мова – не калька» lists the forms to avoid next to the good ones.
    expect(word.synonyms).not.toContain('повсегда');
    expect(word.etymology).toMatch(/^бр\. заўжды́; запозичення з польської мови/);
    expect(word.sources.map((source) => source.title)).toEqual([
      'Словник української мови: в 11 томах. — Том 3, 1972. — Стор. 44.',
      'Горох: словозміна',
      'Горох: синонімія (Цифрові лексикографічні системи української мови; Словник синонімів Караванського)',
      'Горох: етимологія (Етимологічний словник української мови)',
    ]);
    expect(flagsOf(result, 'завжди')).toContainEqual(
      expect.objectContaining({
        kind: 'check',
        message: expect.stringContaining('Мова – не калька') as unknown,
      }),
    );
  });

  it('leaves a field empty when no source gives it, and keeps the draft out of drafts/', async () => {
    // СУМ prints ЗАВЖДИ without a stress mark, and here goroh has no entry.
    const { options } = setup({ lemmaList: 'завжди language-speech 1\n' }, { gorohEmpty: true });

    const result = await sourceWords(options);

    expect(readDrafts(options.outDir)).toEqual([]);
    const [draft, ...others] = readDrafts(options.outDir, 'incomplete');
    expect(others).toEqual([]);
    expect(draft).not.toHaveProperty('stress');
    expect(draft).not.toHaveProperty('synonyms');
    expect(draft).not.toHaveProperty('etymology');
    expect(draft).toMatchObject({
      lemma: 'завжди',
      partOfSpeech: 'adverb',
      primaryDefinition: 'У будь-який час, повсякчас, постійно.',
      sources: [{ url: 'https://sum.in.ua/s/zavzhdy' }],
    });
    const [outcome] = lemmaOutcome(result, 'завжди').drafts;
    expect(outcome?.ready).toBe(false);
    expect(outcome?.issues).toEqual(['stress: Required: the Edition marks Stress']);
    expect(flagsOf(result, 'завжди').map((flag) => flag.kind)).toContain('stress-unresolved');
  });

  describe('checks a draft with the build checks, against the Edition content', () => {
    const lemmaList = 'завжди language-speech 1\n';

    it('puts a draft with a Lemma letter outside the alphabet in incomplete/ with the build message', async () => {
      const editionDir = editionWith((config) => ({
        ...config,
        languageTraits: {
          ...(config['languageTraits'] as Record<string, string>),
          alphabet: 'а б в г ґ д е є з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я',
        },
      }));
      const { options } = setup({ lemmaList, editionDir });

      const result = await sourceWords(options);

      expect(readDrafts(options.outDir)).toEqual([]);
      expect(lemmaOutcome(result, 'завжди').drafts[0]?.issues).toEqual([
        'lemma: "ж" (U+0436) is not a letter of the alphabet or punctuation the Edition allows',
      ]);
    });

    it('puts a draft with Stress in an Edition that does not mark Stress in incomplete/', async () => {
      const editionDir = editionWith((config) => ({
        ...config,
        languageTraits: {
          ...(config['languageTraits'] as Record<string, string>),
          marksStress: false,
        },
      }));
      const { options } = setup({ lemmaList, editionDir });

      const result = await sourceWords(options);

      expect(readDrafts(options.outDir)).toEqual([]);
      expect(lemmaOutcome(result, 'завжди').drafts[0]?.issues).toEqual([
        'stress: Not allowed: the Edition does not mark Stress',
      ]);
    });

    it('puts a draft with the Lemma and primary Definition of an existing Word in incomplete/', async () => {
      const editionDir = editionWith((config) => config, {
        w_exist1: {
          id: 'w_exist1',
          lemma: 'завжди',
          stress: [4],
          partOfSpeech: 'adverb',
          primaryDefinition: 'У будь-який час, повсякчас, постійно.',
          categoryId: 'language-speech',
          rarity: 1,
          sources: [{ title: 'Тестове джерело' }],
        },
      });
      const { options } = setup({ lemmaList, editionDir });

      const result = await sourceWords(options);

      expect(readDrafts(options.outDir)).toEqual([]);
      expect(lemmaOutcome(result, 'завжди').drafts[0]?.issues).toEqual([
        'primaryDefinition: Same Lemma and primary Definition as w_exist1 in content/words/w_exist1.json: author it once, or retire one of them',
      ]);
    });
  });

  it('drafts every homonym from sum.in.ua separately and flags each one', async () => {
    const { options } = setup(
      { lemmaList: 'коса household-crafts 2\n' },
      { withoutGorohDefinitions: true },
    );

    const result = await sourceWords(options);

    const words = readDrafts(options.outDir).map((draft) => WordSchema.parse(draft));
    expect(words.map((word) => word.primaryDefinition).sort()).toEqual([
      'Вузька намивна смуга суходолу в морі, річці тощо, сполучена одним кінцем із берегом; мис.',
      'Заплетене волосся.',
      'Селезінка.',
      'Сільськогосподарське знаряддя для косіння трави, збіжжя тощо, що має вигляд вузького зігнутого леза, прикріпленого до держака.',
    ]);
    expect(new Set(words.map((word) => word.id)).size).toBe(4);
    for (const word of words) {
      expect(word).toMatchObject({ lemma: 'коса', stress: [3], gender: 'feminine' });
      // Synonyms and etymology belong to one sense; a human assigns them.
      expect(word.synonyms).toEqual([]);
      expect(word.etymology).toBeUndefined();
    }
    expect(words.find((word) => word.primaryDefinition === 'Селезінка.')?.registers).toEqual([
      'dialectal',
    ]);

    const outcome = lemmaOutcome(result, 'коса');
    expect(outcome.drafts.map((draft) => draft.headword)).toEqual([
      'КОСА 1',
      'КОСА 2',
      'КОСА 3',
      'КОСА 4',
    ]);
    for (const draft of outcome.drafts) {
      expect(draft.flags.map((flag) => flag.kind)).toContain('homonym');
    }
    const etymologies = outcome.flags.find(
      (flag) => flag.kind === 'needs-assignment' && flag.message.includes('ЕСУМ'),
    );
    expect(etymologies?.message).toContain('коса́ «заплетене волосся»');
    expect(etymologies?.message).not.toContain('ко́сий');
    // КОСА 2 prints its Examples without italics.
    expect(outcome.drafts[1]?.flags.map((flag) => flag.kind)).toContain('unmarked-examples');
    const report = readFileSync(join(options.outDir, 'review-report.md'), 'utf8');
    expect(report).toContain('The dictionary has 4 homonyms');
  });

  it('gives a plural-only noun the plural-only gender', async () => {
    const { options } = setup({ lemmaList: 'ножиці household-crafts 1\n' });

    const result = await sourceWords(options);

    const [draft] = readDrafts(options.outDir);
    expect(draft).toMatchObject({
      lemma: 'ножиці',
      stress: [1],
      partOfSpeech: 'noun',
      gender: 'plural-only',
    });
    expect(flagsOf(result, 'ножиці').map((flag) => flag.kind)).toContain('plural-only');
  });

  it('keeps every valid Stress and flags them, and keeps the shades of a meaning', async () => {
    const { options } = setup({ lemmaList: 'завжди language-speech 1\n' });

    const result = await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.stress).toEqual([1, 5]);
    expect(word.partOfSpeech).toBe('adverb');
    expect(word.primaryDefinition).toBe('У будь-який час, повсякчас, постійно.');
    expect(word.extraDefinitions).toEqual([
      'У віках, навіки; довічно.',
      'Протягом віків; споконвіку.',
    ]);
    // The set phrase «Як завжди» is not a Definition of the Word.
    expect(word.examples.map((example) => example.text)).not.toContainEqual(
      expect.stringContaining('Що ж кажуть лікарі'),
    );
    expect(flagsOf(result, 'завжди').map((flag) => flag.kind)).toContain('several-stresses');
  });

  it('writes no draft for a Lemma no dictionary has, and flags it', async () => {
    const { options } = setup({ lemmaList: 'кшпфтлеон science 3\n' });

    const result = await sourceWords(options);

    expect(readDrafts(options.outDir)).toEqual([]);
    expect(readDrafts(options.outDir, 'incomplete')).toEqual([]);
    expect(lemmaOutcome(result, 'кшпфтлеон').flags).toEqual([
      expect.objectContaining({ kind: 'no-entry' }),
    ]);
  });

  it('answers a re-run from the cache without touching the network', async () => {
    const lemmaList = 'мжичка nature-weather 2\nкоса household-crafts 2\n';
    const first = setup({ lemmaList });
    await sourceWords(first.options);
    const firstDrafts = readDrafts(first.options.outDir);
    expect(first.net.requests.length).toBeGreaterThan(0);

    const second = setup({ lemmaList, cacheDir: first.options.cacheDir, random: seededRandom() });
    const result = await sourceWords(second.options);

    expect(second.net.requests).toEqual([]);
    expect(readDrafts(second.options.outDir)).toEqual(firstDrafts);
    // Only the failed try of sum.in.ua was not cached.
    expect(result.ok && result.report.requests).toEqual({
      network: 0,
      cached: first.net.requests.length - 1,
      backoffs: 0,
      unreachable: {},
    });
  });

  it('treats a corrupt cache file as a miss and fetches the page again', async () => {
    const lemmaList = 'мжичка nature-weather 2\n';
    const first = setup({ lemmaList });
    await sourceWords(first.options);
    const firstDrafts = readDrafts(first.options.outDir);
    const pagesDir = join(first.options.cacheDir, 'pages');
    const pages = readdirSync(pagesDir);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((name, index) => {
      // Half a file, or JSON that is not a response.
      writeFileSync(join(pagesDir, name), index % 2 === 0 ? '{"status": 20' : '{"status":"200"}');
    });

    const second = setup({ lemmaList, cacheDir: first.options.cacheDir, random: seededRandom() });
    const result = await sourceWords(second.options);

    expect(second.net.requests.length).toBeGreaterThan(0);
    expect(readDrafts(second.options.outDir)).toEqual(firstDrafts);
    expect(result.ok && result.report.requests.cached).toBe(0);
  });

  it('releases a host lock left by a crashed process, judged by the injected clock', async () => {
    const { options, net, clock } = setup({ lemmaList: 'мжичка nature-weather 2\n' });
    const start = clock.now();
    leaveLocks(options.cacheDir, start - 20_000);

    const result = await sourceWords(options);

    expect(result.ok).toBe(true);
    // Released at once, so the run is only a lock retry late.
    expect(net.requestTimes[0]).toBeLessThan(start + 1000);
  });

  it('waits for a fresh host lock until the injected clock says it is stale', async () => {
    const { options, net, clock } = setup({ lemmaList: 'мжичка nature-weather 2\n' });
    const start = clock.now();
    leaveLocks(options.cacheDir, start);

    const result = await sourceWords(options);

    expect(result.ok).toBe(true);
    expect(net.requestTimes[0]).toBeGreaterThanOrEqual(start + 10_000);
  });

  it('waits at least two seconds between requests to one host', async () => {
    const { options, net } = setup({
      lemmaList: 'мжичка nature-weather 2\nножиці household-crafts 1\nдратва household-crafts 2\n',
    });

    await sourceWords(options);

    const gaps = gapsPerHost(net);
    expect(gaps.length).toBeGreaterThan(5);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(2000);
  });

  it('shares the cache and the throttle with runs in parallel', async () => {
    const first = setup({ lemmaList: 'дратва household-crafts 2\nножиці household-crafts 1\n' });
    const second = setup({
      lemmaList: 'дратва household-crafts 2\nятір household-crafts 3\n',
      cacheDir: first.options.cacheDir,
      clock: first.clock,
      fetch: first.net.fetch,
    });

    await Promise.all([sourceWords(first.options), sourceWords(second.options)]);

    for (const gap of gapsPerHost(first.net)) expect(gap).toBeGreaterThanOrEqual(2000);
    // At most one run asked for each dratva page; the other read it from the cache.
    const dratva = first.net.requests.filter((address) => address.endsWith('/дратва'));
    expect(dratva.length).toBe(new Set(dratva).size);
  });

  it("drafts from goroh's explanatory dictionary and records the dictionary it cites", async () => {
    const { options, net } = setup({ lemmaList: 'дратва household-crafts 2\n' });

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word).toMatchObject({
      lemma: 'дратва',
      stress: [2],
      partOfSpeech: 'noun',
      gender: 'feminine',
      primaryDefinition:
        'Міцна просмолена або навощена нитка, якою шиють взуття, шкіряні вироби і т. ін.',
    });
    expect(word.examples[0]).toEqual({
      text: 'Землю білою нам дратвою Дід Мороз прошив на славу.',
      author: 'Д. Білоус',
    });
    expect(word.examples).toContainEqual({
      text: '– Бачите, можу тепер і шилом орудувати, й дратву всунути – порядок!',
      author: 'Б. Антоненко-Давидович',
    });
    expect(word.sources).toEqual([
      {
        title: "Тлумачний словник української мови. Томи 1-15 (А-П'ЯТЬ)",
        url: 'https://goroh.pp.ua/Тлумачення/дратва',
      },
    ]);
    // The article gives Stress and grammar, so neither sum.in.ua nor the inflection dictionary is asked.
    expect(net.requests.filter((address) => !address.startsWith(GOROH))).toEqual([]);
    expect(net.requests).not.toContain(`${GOROH}Словозміна/дратва`);
  });

  it('reads the citation from the page, and grammar from goroh when the article has none', async () => {
    const { options } = setup({ lemmaList: 'ятір household-crafts 3\n' });

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word).toMatchObject({
      lemma: 'ятір',
      stress: [0],
      partOfSpeech: 'noun',
      gender: 'masculine',
    });
    expect(word.sources).toEqual([
      {
        title: 'Тлумачний словник української мови в 11-ти томах',
        url: 'https://goroh.pp.ua/Тлумачення/ятір',
      },
      { title: 'Горох: словозміна', url: 'https://goroh.pp.ua/Словозміна/ятір' },
    ]);
  });

  it('keeps register labels that goroh prints as plain text', async () => {
    const { options } = setup({ lemmaList: 'товмач history-antiquity 4\n' });

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.primaryDefinition).toBe(
      'Той, хто усно перекладає з однієї мови на іншу під час бесіди, офіційних переговорів і т. ін.; перекладач.',
    );
    expect(word.registers).toEqual(['archaic']);
  });

  it('reads a verb whose endings give its plural form as a verb', async () => {
    const { options } = setup({ lemmaList: 'гаркавити language-speech 2\n' });

    const result = await sourceWords(options);

    const [draft] = readDrafts(options.outDir);
    expect(draft).toMatchObject({ lemma: 'гаркавити', partOfSpeech: 'verb' });
    expect(draft).not.toHaveProperty('gender');
    expect(flagsOf(result, 'гаркавити').map((flag) => flag.kind)).not.toContain('plural-only');
  });

  it('flags the labels of the other meanings, which the Word cannot carry', async () => {
    const { options } = setup({ lemmaList: 'плесо nature-weather 2\n' });

    const result = await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.registers).toEqual([]);
    expect(word.extraDefinitions).toContain('Грядка чотирикутної форми.');
    expect(flagsOf(result, 'плесо')).toContainEqual({
      kind: 'other-labels',
      message:
        'Labels of other meanings, not carried over: «Грядка чотирикутної форми.» діалектизм',
    });
  });

  it('drops the СУМ markers in front of an Example and keeps every author', async () => {
    const { options } = setup({ lemmaList: 'ятір household-crafts 3\nплесо nature-weather 2\n' });

    await sourceWords(options);

    const examples = readDrafts(options.outDir).flatMap(
      (draft) => WordSchema.parse(draft).examples,
    );
    expect(examples).toContainEqual({
      text: "Захарові здалося, що доля його залишила ще там, у окопчику за Дінцем, і тепер він ось який уже рік самотужки б'ється в ятері життя.",
      author: 'Іван Ле',
    });
    expect(examples).toContainEqual({
      text: 'Перевізники закотили рукави й довгими дрюками відштовхнули нас з прибережної мілини на плесо.',
      author: 'Б.-І. Антонич',
    });
    for (const example of examples) expect(example.text).not.toMatch(/\*/);
  });

  it('names the ЕСУМ article when the etymology is that of a related word', async () => {
    const { options } = setup({ lemmaList: 'мжичка nature-weather 2\n' });

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.sources.at(-1)).toEqual({
      title: 'Горох: етимологія (Етимологічний словник української мови, стаття «мжи́ти»)',
      url: 'https://goroh.pp.ua/Етимологія/мжичка',
    });
  });

  it('drafts goroh homonyms separately, each from its explanatory dictionary', async () => {
    const { options } = setup({ lemmaList: 'коса household-crafts 2\n' });

    const result = await sourceWords(options);

    const outcome = lemmaOutcome(result, 'коса');
    expect(outcome.drafts.map((draft) => draft.headword)).toEqual([
      'КОСА́ 1',
      'КОСА́ 2',
      'КОСА́ 3',
      'КОСА́ 4',
      'КО́СА 5',
    ]);
    const ready = readDrafts(options.outDir).map((draft) => WordSchema.parse(draft));
    expect(ready.map((word) => word.primaryDefinition)).toContain('Заплетене волосся.');
    for (const word of ready) {
      expect(word.sources[0]?.title).toBe(
        "Тлумачний словник української мови. Томи 1-15 (А-П'ЯТЬ)",
      );
    }
    // КО́СА, the people, is masculine and feminine at once: a human picks.
    const [kosa] = readDrafts(options.outDir, 'incomplete');
    expect(kosa).toMatchObject({ stress: [1], partOfSpeech: 'noun' });
    expect(kosa).not.toHaveProperty('gender');
    // The page also carries articles written by a language model and from ВТС; none is drafted.
    const all = [...ready, ...readDrafts(options.outDir, 'incomplete')] as {
      sources: { title: string }[];
    }[];
    for (const draft of all) {
      expect(draft.sources.map((source) => source.title).join()).not.toMatch(/Велик/);
    }
  });

  it('tries sum.in.ua and the Wayback Machine once per run, and skips them once they fail', async () => {
    const { options, net } = setup(
      { lemmaList: 'кшпфтлеон science 3\nабвгджик science 3\n' },
      { waybackDown: true },
    );

    const result = await sourceWords(options);

    const hits = (host: string) => net.requests.filter((address) => address.includes(host)).length;
    expect(hits('sum.in.ua/s/')).toBeLessThanOrEqual(2);
    expect(hits('://sum.in.ua/')).toBe(1);
    expect(hits('web.archive.org')).toBe(1);
    expect(result.ok && Object.keys(result.report.requests.unreachable).sort()).toEqual([
      'sum.in.ua',
      'web.archive.org',
    ]);
    const report = readFileSync(join(options.outDir, 'review-report.md'), 'utf8');
    expect(report).toContain('Skipped for this run: web.archive.org');
  });

  it('backs off more and more when a host rate-limits, and says so', async () => {
    const messages: string[] = [];
    const { options, net } = setup(
      { lemmaList: 'дратва household-crafts 2\n', log: (message) => messages.push(message) },
      { rateLimited: { [`${GOROH}Тлумачення/дратва`]: { status: 429, times: 2 } } },
    );

    const result = await sourceWords(options);

    expect(readDrafts(options.outDir)).toHaveLength(1);
    const times = net.requests.flatMap((address, index) =>
      address === `${GOROH}Тлумачення/дратва` ? [net.requestTimes[index] ?? 0] : [],
    );
    expect(times).toHaveLength(3);
    expect((times[1] ?? 0) - (times[0] ?? 0)).toBeGreaterThanOrEqual(5000);
    expect((times[2] ?? 0) - (times[1] ?? 0)).toBeGreaterThanOrEqual(10_000);
    expect(result.ok && result.report.requests.backoffs).toBe(2);
    expect(messages).toEqual([
      'goroh.pp.ua: HTTP 429; backing off for 5 s (1/4)',
      'goroh.pp.ua: HTTP 429; backing off for 10 s (2/4)',
    ]);
  });

  it('reads sum.in.ua itself when the site is reachable', async () => {
    const { options, net } = setup(
      { lemmaList: 'мжичка nature-weather 2\n' },
      { sumReachable: { 'https://sum.in.ua/s/mzhychka': 'sum/mzhychka.html' } },
    );

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.sources[0]).toEqual({
      title: 'Словник української мови: в 11 томах. — Том 4, 1973. — Стор. 698.',
      url: 'https://sum.in.ua/s/mzhychka',
    });
    expect(net.requests.filter((address) => address.includes('web.archive.org'))).toEqual([]);
  });

  it('never issues an id the registry lists, even one without a Word file', async () => {
    // The first id this source of randomness spells is w_olmlqv, listed in the registry of the Edition.
    const taken = 'olmlqv';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const numbers = Array.from(
      taken,
      (letter) => (alphabet.indexOf(letter) + 0.5) / alphabet.length,
    );
    const next = seededRandom();
    const editionDir = editionWith((config) => config, {}, [`w_${taken}`]);
    const { options } = setup({
      lemmaList: 'мжичка nature-weather 2\n',
      editionDir,
      random: () => numbers.shift() ?? next(),
    });

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.id).not.toBe(`w_${taken}`);
    expect(word.id).toMatch(/^w_[a-z0-9]{6}$/);
  });

  it('refuses an Edition whose id registry is invalid, before fetching', async () => {
    const editionDir = editionWith((config) => config, {}, ['w_aaaaaa', 'w_aaaaaa']);
    const { options, net } = setup({ lemmaList: 'мжичка nature-weather 2\n', editionDir });

    const result = await sourceWords(options);

    expect(result.ok).toBe(false);
    expect(net.requests).toEqual([]);
  });

  it('refuses an Edition in another language than its dictionaries, before fetching', async () => {
    const editionDir = mkdtempSync(join(tmpdir(), 'slovo-edition-'));
    const config = JSON.parse(readFileSync(join(ukrainianEditionDir, 'edition.json'), 'utf8')) as {
      locale: string;
    };
    writeFileSync(join(editionDir, 'edition.json'), JSON.stringify({ ...config, locale: 'pl-PL' }));
    const { options, net } = setup({ lemmaList: 'мжичка nature-weather 2\n', editionDir });

    const result = await sourceWords(options);

    expect(result).toEqual({
      ok: false,
      errors: ['The sources are Ukrainian dictionaries, but the Edition is in pl-PL'],
    });
    expect(net.requests).toEqual([]);
  });

  it('rejects a Lemma list with unknown Categories or rarities out of range, before fetching', async () => {
    const { options, net } = setup({
      lemmaList: '# Lemma, Category, rarity\nмжичка weather 2\nкоса household-crafts 6\nножиці\n',
    });

    const result = await sourceWords(options);

    expect(result).toEqual({
      ok: false,
      errors: [
        'Line 2: Unknown Category "weather"',
        'Line 3: Rarity "6" is not a whole number from 1 to 5',
        'Line 4: Expected "<lemma> <category id> <rarity>"',
      ],
    });
    expect(net.requests).toEqual([]);
  });
});

/** A lock folder for each host, as a process that crashed would leave it, modified at `modifiedMs`. */
function leaveLocks(cacheDir: string, modifiedMs: number): void {
  for (const host of ['web.archive.org', 'goroh.pp.ua', 'sum.in.ua']) {
    const lock = join(cacheDir, 'hosts', `${host}.lock`);
    mkdirSync(lock, { recursive: true });
    utimesSync(lock, modifiedMs / 1000, modifiedMs / 1000);
  }
}

/** The time between consecutive requests to the same host. */
function gapsPerHost(net: FakeNetwork): number[] {
  const last = new Map<string, number>();
  const gaps: number[] = [];
  net.requests.forEach((address, index) => {
    const host = new URL(encodeURI(address)).hostname;
    const time = net.requestTimes[index] ?? 0;
    const previous = last.get(host);
    if (previous !== undefined) gaps.push(time - previous);
    last.set(host, time);
  });
  return gaps;
}

function lemmaOutcome(result: SourcingResult, lemma: string): LemmaOutcome {
  if (!result.ok) throw new Error(result.errors.join('\n'));
  const outcome = result.report.lemmas.find((candidate) => candidate.lemma === lemma);
  if (outcome === undefined) throw new Error(`No outcome for ${lemma}`);
  return outcome;
}

/** Every flag raised for a Lemma, on the Lemma and on its drafts. */
function flagsOf(result: SourcingResult, lemma: string): Flag[] {
  const outcome = lemmaOutcome(result, lemma);
  return [...outcome.flags, ...outcome.drafts.flatMap((draft) => draft.flags)];
}
