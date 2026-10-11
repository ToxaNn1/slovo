import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
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

interface FakeNetwork {
  readonly fetch: Fetch;
  /** The decoded address of every request that reached the network, in order. */
  readonly requests: string[];
  /** The fake clock's reading at each request, in milliseconds. */
  readonly requestTimes: number[];
}

/**
 * The saved pages stand in for the sites. sum.in.ua itself is unreachable
 * unless `sumReachable` lists pages it serves directly, and goroh has no
 * entries at all when `gorohEmpty` is set. Any other address
 * answers with goroh's real "not found" page or fails like a dead host.
 */
function fakeNetwork(
  clock: { now: () => number },
  {
    sumReachable = {},
    gorohEmpty = false,
  }: { sumReachable?: Record<string, string>; gorohEmpty?: boolean } = {},
): FakeNetwork {
  const requests: string[] = [];
  const requestTimes: number[] = [];
  const fetch: Fetch = (url) => {
    const address = decodeURI(url);
    requests.push(address);
    requestTimes.push(clock.now());
    const direct = sumReachable[address];
    if (direct !== undefined) return Promise.resolve({ status: 200, body: readFixture(direct) });
    const saved = gorohEmpty && address.startsWith(GOROH) ? undefined : savedPages[address];
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

/** A clock whose sleep only moves time forward. */
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

/** A repeatable stand-in for Math.random. */
function seededRandom(seed = 7) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

function setup(
  overrides: Partial<SourcingOptions> = {},
  network?: { sumReachable?: Record<string, string>; gorohEmpty?: boolean },
) {
  const clock = fakeClock();
  const net = fakeNetwork(clock, network);
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-sourcing-'));
  const options: SourcingOptions = {
    lemmaList: '',
    editionDir: ukrainianEditionDir,
    outDir: join(workDir, 'review'),
    cacheDir: join(workDir, 'cache'),
    fetch: net.fetch,
    clock,
    random: seededRandom(),
    ...overrides,
  };
  return { options, net, workDir };
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

  it('drafts every homonym separately and flags each one', async () => {
    const { options } = setup({ lemmaList: 'коса household-crafts 2\n' });

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
    expect(report).toContain('СУМ has 4 homonyms');
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
    expect(result.ok && result.report.requests).toEqual({
      network: 0,
      cached: first.net.requests.length - 1,
    });
  });

  it('waits at least two seconds between requests to the sites', async () => {
    const { options, net } = setup({
      lemmaList: 'мжичка nature-weather 2\nножиці household-crafts 1\n',
    });

    await sourceWords(options);

    const gaps = net.requestTimes
      .slice(1)
      .map((time, index) => time - (net.requestTimes[index] ?? 0));
    expect(gaps.length).toBeGreaterThan(5);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(2000);
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

  it('never reuses an id the Edition already has', async () => {
    // The first id this source of randomness spells is w_olmlqv, a Word of the Ukrainian Edition.
    const taken = 'olmlqv';
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const numbers = Array.from(
      taken,
      (letter) => (alphabet.indexOf(letter) + 0.5) / alphabet.length,
    );
    const next = seededRandom();
    const { options } = setup({
      lemmaList: 'мжичка nature-weather 2\n',
      random: () => numbers.shift() ?? next(),
    });

    await sourceWords(options);

    const word = WordSchema.parse(readDrafts(options.outDir)[0]);
    expect(word.id).not.toBe(`w_${taken}`);
    expect(word.id).toMatch(/^w_[a-z0-9]{6}$/);
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
