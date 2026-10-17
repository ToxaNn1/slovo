import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CorrectionSchema, EditionConfigSchema, WordSchema } from '@slovo/contracts';
import { createMemoryContentPort, type ContentReadPort } from '@slovo/core';

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

/** The fixture Edition with Correction c_fx0002 retired, so both kinds have a Retired Entry. */
function editionWithRetiredCorrection(): string {
  const editionDir = join(workDir(), 'edition');
  cpSync(fixtureDir, editionDir, { recursive: true });
  const file = join(editionDir, 'content/corrections/c_fx0002.json');
  const correction = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, JSON.stringify({ ...correction, retired: true }));
  if (!recordContent({ editionDir }).ok) throw new Error('The fixture does not record');
  return editionDir;
}

/** The Categories of an Edition as authored, in its order. */
function authoredCategories(editionDir: string) {
  const config = JSON.parse(readFileSync(join(editionDir, 'edition.json'), 'utf8')) as unknown;
  return EditionConfigSchema.parse(config).categories;
}

/** The Entries of an Edition as authored, each kind in id order. */
function authored(editionDir: string, kind: 'words' | 'corrections'): unknown[] {
  const dir = join(editionDir, 'content', kind);
  return readdirSync(dir)
    .sort()
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown);
}

const adapters: [
  string,
  (editionDir: string) => { content: ContentReadPort; close: () => void },
][] = [
  [
    'in memory',
    (editionDir) => ({
      content: createMemoryContentPort({
        categories: authoredCategories(editionDir),
        words: authored(editionDir, 'words').map((word) => WordSchema.parse(word)),
        corrections: authored(editionDir, 'corrections').map((correction) =>
          CorrectionSchema.parse(correction),
        ),
      }),
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
    ({ content, close } = open(editionWithRetiredCorrection()));
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

  it('lists the live Words in a stable order, leaving a Retired Word out', async () => {
    expect(await content.listWordIds()).toEqual(['w_fx0002', 'w_fx0003']);
  });

  it('lists the live Words of one Category', async () => {
    expect(await content.listWordIds('speech')).toEqual(['w_fx0002', 'w_fx0003']);
    // Its only Word is Retired.
    expect(await content.listWordIds('nature')).toEqual([]);
    expect(await content.listWordIds('unknown')).toEqual([]);
  });

  it('gives the live Words themselves in the order it lists them, each as by id', async () => {
    const words = await content.listWords();

    expect(words.map((word) => word.id)).toEqual(await content.listWordIds());
    for (const word of words) expect(word).toEqual(await content.getWord(word.id));
  });

  it('gives any Word by id, a Retired Word included', async () => {
    expect(await content.getWord('w_fx0002')).toMatchObject({ lemma: 'балакучий' });
    expect(await content.getWord('w_fx0001')).toMatchObject({ retired: true });
    expect(await content.getWord('w_missing')).toBeUndefined();
  });

  it('lists the live Corrections in a stable order, leaving a Retired Correction out', async () => {
    expect(await content.listCorrectionIds()).toEqual(['c_fx0001', 'c_fx0003', 'c_fx0004']);
  });

  it('gives any Correction by id, a Retired Correction included', async () => {
    expect(await content.getCorrection('c_fx0001')).toMatchObject({ kind: 'correction' });
    expect(await content.getCorrection('c_fx0002')).toMatchObject({ retired: true });
    expect(await content.getCorrection('c_missing')).toBeUndefined();
  });

  it('lists the live Words linked to a Correction, leaving a Retired Word out', async () => {
    expect(await content.listLinkedWordIds('c_fx0002')).toEqual(['w_fx0002']);
    // Linked from a Retired Word only.
    expect(await content.listLinkedWordIds('c_fx0003')).toEqual([]);
    expect(await content.listLinkedWordIds('c_fx0004')).toEqual([]);
  });
});

describe('the Ukrainian Language Pack', () => {
  it('lists the 10 Categories in their order, keeping the ids its Words already use', async () => {
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
      ]);
      expect(categories.map(({ id }) => id)).toEqual(
        expect.arrayContaining(['nature-weather', 'household-crafts', 'language-speech']),
      );
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
        const words = await Promise.all(wordIds.map((wordId) => pack.getWord(wordId)));
        expect(words.every((word) => word?.categoryId === id && !word.retired)).toBe(true);
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
      for (const word of words) expect(word).toEqual(await pack.getWord(word.id));
    } finally {
      pack.close();
    }
  });
});
