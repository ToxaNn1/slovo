import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createEntries,
  type Idiom,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Entries,
} from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainian, ukrainianFolder } from './test-support';

// The Idioms of the real Ukrainian Language Pack, read by the Core as the app
// reads them (spec #549, seam 1). It lives here because only this package can
// build and read a pack in Node.

let workDir: string;
let pack: NodeLanguagePack;
let entries: Entries;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-idioms-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  entries = createEntries({ content: pack, edition: ukrainian });
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('the Idioms of the Ukrainian Edition', () => {
  it('turns Idioms on and has them in the default Mix', () => {
    expect(ukrainian.isFeatureEnabled('idioms')).toBe(true);
    expect(ukrainianFolder.config.userSettingDefaults.mix.idioms).toBe(true);
  });

  it('names each Idiom Type in the Edition strings', () => {
    expect(ukrainianFolder.read('strings').idiomCard.idiomTypes).toEqual({
      idiom: 'фразеологізм',
      placeName: 'топонім',
    });
  });

  // The total is the Edition's `minIdioms` content target; the build checks it.
  it('holds Idioms of each Idiom Type, each with its sources', async () => {
    const idioms = (await pack.getEntries(await pack.listIdiomIds())).filter(
      (entry): entry is Idiom => entry.kind === 'idiom',
    );
    const ofType = (idiomType: string) => idioms.filter((idiom) => idiom.idiomType === idiomType);

    expect(ofType('idiom').length).toBeGreaterThan(0);
    expect(ofType('placeName').length).toBeGreaterThan(0);
    expect(idioms.map(({ expression }) => expression)).toEqual(
      expect.arrayContaining(['бити байдики', 'пекти раків', 'Бердичів']),
    );
    for (const idiom of idioms) expect(idiom.sources.length).toBeGreaterThan(0);
  });

  it('gives each Idiom by id with its fields through the Entries', async () => {
    expect(await entries.get('i_8f3kq2')).toEqual({
      kind: 'idiom',
      id: 'i_8f3kq2',
      expression: 'бити байдики',
      idiomType: 'idiom',
      primaryDefinition: 'Ледарювати, нічого не робити.',
      extraDefinitions: ['Марно гаяти час.'],
      examples: [{ text: 'Замість допомогти батькам у полі, хлопець цілими днями бив байдики.' }],
      etymology:
        'Байдики — цурпалки, якими бавилися в дитячій грі; той, хто їх бив, нічого корисного не робив.',
      sources: [
        { title: 'Горох: фразеологія', url: 'https://goroh.pp.ua/Фразеологія/байдики' },
        {
          title: 'Тлумачний словник української мови в 11-ти томах',
          url: 'https://goroh.pp.ua/Тлумачення/байдики',
        },
      ],
      retired: false,
    });
    expect(await entries.get('i_d5tc9n')).toMatchObject({
      kind: 'idiom',
      expression: 'Бердичів',
      idiomType: 'placeName',
      primaryDefinition: "Місто на Житомирщині, на річці Гнилоп'ять.",
      etymology: expect.stringContaining('Бердич') as string,
    });
  });

  it('gives every Idiom at once, with the Words and Corrections, as it gives each by id', async () => {
    const ids = ['i_8f3kq2', 'i_m2vr7s', 'i_d5tc9n', 'c_0ci49m', 'w_missing'];
    const found = await entries.getMany([...ids, ...(await pack.listWordIds()).slice(0, 2)]);

    expect([...found.keys()].filter((id) => id.startsWith('i_')).toSorted()).toEqual([
      'i_8f3kq2',
      'i_d5tc9n',
      'i_m2vr7s',
    ]);
    for (const id of ids.slice(0, 4)) expect(found.get(id)).toEqual(await entries.get(id));
    expect(found.has('w_missing')).toBe(false);
  });

  it('has every live Idiom eligible, in the pack order, without a user state', async () => {
    const ids = await pack.listIdiomIds();

    expect((await entries.eligible()).idioms).toEqual(ids);
    expect(await entries.eligibleOfKind('idiom')).toEqual({
      entries: await Promise.all(ids.map((id) => entries.get(id))),
    });
  });
});

describe('the Known Idioms of the Ukrainian Language Pack', () => {
  it('counts the Idioms marked Known, a place name too, apart from the Words and Corrections', async () => {
    const app = await openComposition({
      content: pack,
      edition: ukrainian,
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: { now: () => new Date('2026-10-23T09:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
      random: { next: () => 0.25 },
    });
    const [wordId] = await pack.listWordIds();
    if (wordId === undefined) throw new Error('The Ukrainian Language Pack has no Words');

    await app.knowledge.tap('i_8f3kq2', 'known');
    await app.knowledge.tap('i_d5tc9n', 'known');
    await app.knowledge.tap('i_m2vr7s', 'unknown');
    await app.knowledge.tap('c_0ci49m', 'known');
    await app.knowledge.tap(wordId, 'known');

    const known = { word: 1, correction: 1, idiom: 2 };
    expect(app.knowledge.state.known).toEqual(known);
    expect(app.progress.state.known).toEqual(known);
  });
});
