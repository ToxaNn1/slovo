import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, openComposition, openUserState, type Clock } from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainian, ukrainianFolder } from './test-support';

// The rows of the Idioms the reader keeps, over the real Ukrainian Language
// Pack opened through the Core composition (spec #549, seam 1). It lives here
// because only this package can build and read a pack in Node.

let workDir: string;
let pack: NodeLanguagePack;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-entry-rows-'));
  const outFile = join(workDir, 'language-pack.db');
  if (!buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile }).ok) {
    throw new Error('The Ukrainian Language Pack does not build');
  }
  pack = openLanguagePack(outFile);
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

const clock: Clock = {
  now: () => new Date('2026-10-23T09:00:00+03:00'),
  timeZone: () => 'Europe/Kyiv',
};

/** «бити байдики», an idiom. */
const IDIOM = 'i_8f3kq2';
/** «Бердичів», a place name. */
const PLACE_NAME = 'i_d5tc9n';

const idiomRow = {
  kind: 'idiom',
  entryId: IDIOM,
  title: 'бити байдики',
  secondLine: 'Ледарювати, нічого не робити.',
  kindKey: 'idiom',
  spoken: 'бити байдики, Ледарювати, нічого не робити.',
};
const placeNameRow = {
  kind: 'idiom',
  entryId: PLACE_NAME,
  title: 'Бердичів',
  secondLine: "Місто на Житомирщині, на річці Гнилоп'ять.",
  kindKey: 'placeName',
  spoken: "Бердичів, Місто на Житомирщині, на річці Гнилоп'ять.",
};

/** The composition over the pack for a reader who Saw both Idioms and marks them Unknown. */
async function open() {
  const records = new Map<string, string>();
  for (const [entryId, seenAt] of [
    [IDIOM, '2026-10-23T05:00:00.000Z'],
    [PLACE_NAME, '2026-10-23T05:30:00.000Z'],
  ] as const) {
    records.set(`history.${entryId}`, JSON.stringify({ seenAt, wordOfTheDay: false }));
    records.set(
      `knowledge.${entryId}`,
      JSON.stringify({ mark: 'unknown', step: 1, reviewDay: '2026-10-24', learned: false }),
    );
  }
  return openComposition({
    content: pack,
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
}

describe('the rows of the Idioms the reader keeps', () => {
  it('show the expression and the Idiom Type in History, newest first', async () => {
    const app = await open();

    expect(app.history.list.map(({ row }) => row)).toEqual([placeNameRow, idiomRow]);
  });

  it('open the Idiom card of the row tapped', async () => {
    const app = await open();

    expect(await app.entryCard(PLACE_NAME)).toMatchObject({
      kind: 'idiom',
      entryId: PLACE_NAME,
      model: { expression: 'Бердичів', idiomType: 'placeName' },
    });
  });

  it('show the expression and the Idiom Type in a Collection and in Favorites', async () => {
    const app = await open();

    const created = await app.collections.create('Вирази', IDIOM);
    if (!created.ok) throw new Error('The Collection was not created');
    await app.collections.add(created.collection.id, PLACE_NAME);
    await app.favorites.add(PLACE_NAME);

    expect(app.collections.entries(created.collection.id).map(({ row }) => row)).toEqual(
      expect.arrayContaining([idiomRow, placeNameRow]),
    );
    expect(app.favorites.list.map(({ row }) => row)).toEqual([placeNameRow]);
  });

  it('show the expression and the Idiom Type in the «Вчу» list and on the Hidden screen', async () => {
    const app = await open();

    expect(app.knowledge.state.learning.map(({ row }) => row)).toEqual(
      expect.arrayContaining([idiomRow, placeNameRow]),
    );

    await app.hide({ kind: 'entry', entryId: PLACE_NAME });

    expect(app.hiddenEntries.list.map(({ row }) => row)).toEqual([placeNameRow]);
  });
});
