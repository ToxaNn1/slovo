import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type ContentReadPort } from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';

import { editionFiles } from './edition-folder';
import { buildLanguagePack, openLanguagePack, recordContent } from './index';

// One contract for both adapters of the Core's content read port: the
// in-memory one the Core ships for tests, and the reader of a compiled pack.

const fixtureDir = fileURLToPath(new URL('../fixtures/valid', import.meta.url));
const ukrainianDir = fileURLToPath(new URL('../../../editions/uk', import.meta.url));

const workDirs: string[] = [];

afterAll(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function workDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-content-port-'));
  workDirs.push(dir);
  return dir;
}

/** Builds the Edition into a pack and opens it. */
function openPack(editionDir: string) {
  const outFile = join(workDir(), 'language-pack.db');
  if (!buildLanguagePack({ editionDir, outFile }).ok)
    throw new Error(`${editionDir} does not build`);
  return openLanguagePack(outFile);
}

/** The fixture Edition with Correction c_fx0002 and Idiom i_fx0002 retired, so every kind has a Retired Entry. */
function editionWithRetiredEntries(): string {
  const editionDir = join(workDir(), 'edition');
  cpSync(fixtureDir, editionDir, { recursive: true });
  for (const file of ['content/corrections/c_fx0002.json', 'content/idioms/i_fx0002.json']) {
    const path = join(editionDir, file);
    const entry = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    writeFileSync(path, JSON.stringify({ ...entry, retired: true }));
  }
  if (!recordContent({ editionDir }).ok) throw new Error('The fixture does not record');
  return editionDir;
}

/** The Categories and Entries of an Edition as authored, through the one reader (ADR 0035). */
function authored(editionDir: string) {
  const files = editionFiles(editionDir);
  const { words, corrections, idioms } = files.entries();
  return {
    categories: files.read('config').categories,
    correctionCategories: files.read('config').correctionCategories,
    words: words.map(({ entry }) => entry),
    corrections: corrections.map(({ entry }) => entry),
    idioms: idioms.map(({ entry }) => entry),
  };
}

const adapters: [
  string,
  (editionDir: string) => { content: ContentReadPort; close: () => void },
][] = [
  [
    'in memory',
    (editionDir) => ({
      content: createMemoryContentPort(authored(editionDir)),
      close: () => undefined,
    }),
  ],
  [
    'over a compiled pack',
    (editionDir) => {
      const pack = openPack(editionDir);
      return {
        content: pack,
        close: () => {
          pack.close();
        },
      };
    },
  ],
];

describe.each(adapters)('the content read port %s', (_, open) => {
  let content: ContentReadPort;
  let close: () => void;

  beforeAll(() => {
    ({ content, close } = open(editionWithRetiredEntries()));
  });

  afterAll(() => {
    close();
  });

  it('lists every Category in the Edition order with its display name, one of Retired Words only included', async () => {
    expect(await content.listCategories()).toEqual([
      { id: 'nature', displayName: 'Природа' },
      { id: 'speech', displayName: 'Мовлення' },
    ]);
  });

  it("lists every Category of Corrections in the Edition order, apart from the Words' Categories", async () => {
    expect(await content.listCorrectionCategories()).toEqual([
      { id: 'work', displayName: 'На роботі' },
      { id: 'shop', displayName: 'У магазині' },
    ]);
  });

  it('lists the live Words in a stable order, leaving a Retired Word out', async () => {
    expect(await content.listWordIds()).toEqual(['w_fx0002', 'w_fx0003']);
  });

  it('lists the live Words of one Category', async () => {
    expect(await content.listWordIds('speech')).toEqual(['w_fx0002', 'w_fx0003']);
    // Its only Word is Retired.
    expect(await content.listWordIds('nature')).toEqual([]);
    expect(await content.listWordIds('unknown')).toEqual([]);
  });

  /** The Entries by id, as `getEntries` gives them, in id order. */
  const byId = (entries: readonly { id: string }[]) =>
    entries.toSorted((a, b) => a.id.localeCompare(b.id));
  const idsOf = (entries: readonly { id: string }[]) => entries.map(({ id }) => id).toSorted();
  /** One Entry by id. */
  const one = async (id: string) => (await content.getEntries([id]))[0];

  it('gives the live Words themselves in the order it lists them, each as by id', async () => {
    const words = await content.listWords();

    expect(words.map((word) => word.id)).toEqual(await content.listWordIds());
    expect(byId(await content.getEntries(words.map((word) => word.id)))).toEqual(words);
  });

  it('gives any Entry by id whatever its kind, a Retired one included, and nothing for an unknown id', async () => {
    expect(await one('w_fx0002')).toMatchObject({ kind: 'word', lemma: 'балакучий' });
    expect(await one('w_fx0001')).toMatchObject({ kind: 'word', retired: true });
    expect(await one('c_fx0001')).toMatchObject({ kind: 'correction', retired: false });
    expect(await one('c_fx0002')).toMatchObject({ kind: 'correction', retired: true });
    expect(await one('i_fx0001')).toEqual({
      kind: 'idiom',
      id: 'i_fx0001',
      expression: 'бити байдики',
      idiomType: 'idiom',
      primaryDefinition: 'Тестове значення: ледарювати, нічого не робити.',
      extraDefinitions: ['Тестове друге значення: марнувати час.'],
      examples: [{ text: 'Цілий день він бив байдики.', author: 'Тестовий автор' }],
      etymology: 'Тестове походження: від назви цурпалків для дитячої гри.',
      sources: [{ title: 'Тестове джерело', url: 'https://example.org/baidyky' }],
      retired: false,
    });
    expect(await one('i_fx0002')).toMatchObject({ idiomType: 'placeName', retired: true });
    for (const id of ['w_missing', 'c_missing', 'i_missing']) {
      expect(await one(id)).toBeUndefined();
    }
  });

  /** More ids than one read of the pack binds, none of them in the pack. */
  const manyMissing = Array.from({ length: 1200 }, (_, place) => `x_${String(place)}`);

  it('gives the Entries of many ids of every kind at once, each as by id, leaving an unknown id out', async () => {
    const ids = ['w_fx0002', 'c_fx0002', 'i_fx0001', 'w_fx0001', 'c_fx0001', 'i_fx0002'];

    const entries = await content.getEntries([...manyMissing, ...ids]);

    expect(idsOf(entries)).toEqual(ids.toSorted());
    for (const entry of entries) expect(entry).toEqual(await one(entry.id));
    expect(await content.getEntries([])).toEqual([]);
  });

  it('lists the live Words linked to a Correction, leaving a Retired Word out', async () => {
    expect(await content.listLinkedWordIds('c_fx0002')).toEqual(['w_fx0002']);
    // Linked from a Retired Word only.
    expect(await content.listLinkedWordIds('c_fx0003')).toEqual([]);
    expect(await content.listLinkedWordIds('c_fx0004')).toEqual([]);
  });
});

describe('the Ukrainian Language Pack', () => {
  it('builds and meets every content target, the floors of «Діалекти», «Дотепна лайка», Idioms and Corrections per Category included', () => {
    const result = buildLanguagePack({
      editionDir: ukrainianDir,
      outFile: join(workDir(), 'language-pack.db'),
    });

    expect(result.ok && result.missedTargets).toEqual([]);
  });

  it('lists the 12 Categories in their order, keeping the ids its Words already use', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const categories = await pack.listCategories();

      expect(categories.map(({ displayName }) => displayName)).toEqual([
        'Людина і тіло',
        'Емоції та характер',
        'Природа і погода',
        'Побут і ремесла',
        'Техніка',
        'Військова справа',
        'Мистецтво і культура',
        'Історія та старовина',
        'Наука',
        'Мова і мовлення',
        'Діалекти',
        'Дотепна лайка',
        'Народні назви',
        'Старі ремесла',
        'Розстріляна лексика',
      ]);
      expect(categories.map(({ id }) => id)).toEqual(
        expect.arrayContaining(['nature-weather', 'household-crafts', 'language-speech']),
      );
    } finally {
      pack.close();
    }
  });

  it('lists the 7 Categories of Corrections in their order, every one holding live Corrections', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const categories = await pack.listCorrectionCategories();
      const corrections = await pack.getEntries(await pack.listCorrectionIds());

      expect(categories.map(({ displayName }) => displayName)).toEqual([
        'У розмові',
        'Вдома',
        'На роботі',
        'У магазині',
        'Транспорт',
        'У школі',
        'Дозвілля і медіа',
      ]);
      expect(
        new Set(corrections.map((entry) => (entry.kind === 'correction' ? entry.categoryId : ''))),
      ).toEqual(new Set(categories.map(({ id }) => id)));
    } finally {
      pack.close();
    }
  });

  it('holds 15 Words in «Діалекти», each with the dialectal register label and a region', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const words = await pack.getEntries(await pack.listWordIds('dialects'));

      expect(words).toHaveLength(15);
      for (const word of words) {
        expect(word).toMatchObject({
          kind: 'word',
          registers: expect.arrayContaining(['dialectal']) as unknown,
          region: expect.any(String) as unknown,
        });
      }
    } finally {
      pack.close();
    }
  });

  it('holds 15 Words in «Дотепна лайка», each with its Stress', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const words = await pack.getEntries(await pack.listWordIds('witty-insults'));

      expect(words).toHaveLength(15);
      for (const word of words) {
        expect(word.kind === 'word' && word.stress).not.toEqual([]);
      }
    } finally {
      pack.close();
    }
  });

  it('holds 15 Words in «Народні назви», each with its sources', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const words = await pack.getEntries(await pack.listWordIds('folk-names'));

      expect(words).toHaveLength(15);
      for (const word of words) {
        expect(word.kind === 'word' && word.sources).not.toEqual([]);
      }
    } finally {
      pack.close();
    }
  });

  it('holds 15 Words in «Старі ремесла», each with its sources', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const words = await pack.getEntries(await pack.listWordIds('old-crafts'));

      expect(words).toHaveLength(15);
      for (const word of words) {
        expect(word.kind === 'word' && word.sources).not.toEqual([]);
      }
    } finally {
      pack.close();
    }
  });

  it('holds at least 15 Idioms of type proverb, each with its sources', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const idioms = await pack.getEntries(await pack.listIdiomIds());
      const proverbs = idioms.filter(
        (idiom) => idiom.kind === 'idiom' && idiom.idiomType === 'proverb',
      );

      expect(proverbs.length).toBeGreaterThanOrEqual(15);
      for (const proverb of proverbs) {
        expect(proverb.kind === 'idiom' && proverb.sources).not.toEqual([]);
      }
    } finally {
      pack.close();
    }
  });

  it('holds 15 Words in «Розстріляна лексика», each with its history and sources', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const words = await pack.getEntries(await pack.listWordIds('repressed-words'));

      expect(words).toHaveLength(15);
      for (const word of words) {
        expect(word.kind === 'word' && word.history).toBeTruthy();
        expect(word.kind === 'word' && word.sources).not.toEqual([]);
      }
    } finally {
      pack.close();
    }
  });

  it('lists every live Word under its own Category', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const byCategory = await Promise.all(
        (await pack.listCategories()).map(async ({ id }) => ({
          id,
          wordIds: await pack.listWordIds(id),
        })),
      );
      for (const { id, wordIds } of byCategory) {
        const words = await pack.getEntries(wordIds);
        expect(words).toHaveLength(wordIds.length);
        expect(
          words.every((word) => word.kind === 'word' && word.categoryId === id && !word.retired),
        ).toBe(true);
      }
      const listed = byCategory.flatMap(({ wordIds }) => wordIds);
      expect(listed.toSorted()).toEqual([...(await pack.listWordIds())].toSorted());
    } finally {
      pack.close();
    }
  });

  it('gives every live Word at once as it gives each by id', async () => {
    const pack = openPack(ukrainianDir);
    try {
      const words = await pack.listWords();

      expect(words.map((word) => word.id)).toEqual(await pack.listWordIds());
      const each = await pack.getEntries(words.map((word) => word.id));
      expect(each.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(words);
    } finally {
      pack.close();
    }
  });
});
