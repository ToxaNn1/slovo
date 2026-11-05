import type { CuratedCollection } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type FeatureSwitch } from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, settle, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

function collection(id: string, publishedOn: string): CuratedCollection {
  return { id, name: `Name ${id}`, description: `About ${id}`, publishedOn, entryIds: ['w_one'] };
}

const collections = [
  collection('cc_jan', '2026-01-01'),
  collection('cc_today', '2026-11-04'),
  collection('cc_tomorrow', '2026-11-05'),
  collection('cc_oct', '2026-10-20'),
];

/** The Core composition of one app run over the records, the Curated Collections on unless said otherwise. */
async function run({
  records = new Map<string, string>(),
  on = ['wordOfTheDay', 'dashboard', 'curatedCollections'],
  curatedCollections = collections,
  start = '2026-11-04T09:00:00+02:00',
}: {
  records?: Map<string, string>;
  on?: FeatureSwitch[];
  curatedCollections?: readonly CuratedCollection[];
  start?: string;
} = {}) {
  const time = fakeClock(start);
  const app = await openComposition({
    content: createMemoryContentPort({
      words: [word('w_one'), word('w_two'), word('w_three')],
      curatedCollections,
    }),
    edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { app, time, records };
}

const idsOf = (app: Awaited<ReturnType<typeof run>>['app']) =>
  app.curatedCollections.rail.map(({ collection: { id }, state }) => `${id}:${state}`);

describe('The Curated Collections rail', () => {
  it('shows the collections published by today, newest first, all new', async () => {
    const { app } = await run();

    expect(idsOf(app)).toEqual(['cc_today:new', 'cc_oct:new', 'cc_jan:new']);
    const block = app.dashboard.blocks.find((it) => it.kind === 'curatedCollections');
    expect(block?.kind === 'curatedCollections' && block.cards).toEqual(
      app.curatedCollections.rail,
    );
  });

  it('comes before the Correction Types rail on the Dashboard', async () => {
    const app = await openComposition({
      content: createMemoryContentPort({
        words: [word('w_one'), word('w_two')],
        corrections: [correction('c_one', { correctionType: 'calque' })],
        curatedCollections: collections,
      }),
      edition: testEdition({
        isFeatureEnabled: (feature) =>
          ['dashboard', 'curatedCollections', 'corrections', 'correctionTypes'].includes(feature),
      }),
      userState: await openUserState({ port: createMemoryUserStatePort() }),
      clock: fakeClock('2026-11-04T09:00:00+02:00').clock,
      random: { next: () => 0.25 },
    });

    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual([
      'wordOfTheDay',
      'curatedCollections',
      'correctionTypes',
    ]);
  });

  it('is unlocked by the local date: a collection appears the day it is published', async () => {
    const { app, time } = await run({ start: '2026-11-04T23:59:00+02:00' });
    expect(idsOf(app)).not.toContain('cc_tomorrow:new');

    time.advance(2 * 60 * 1000);
    await app.resume();

    expect(idsOf(app)[0]).toBe('cc_tomorrow:new');
  });

  it('moves an opened collection behind the unopened ones, and the Dashboard follows', async () => {
    const { app, records } = await run();
    let told = 0;
    app.dashboard.subscribe(() => (told += 1));

    await app.curatedCollections.open('cc_today');
    await settle();

    expect(idsOf(app)).toEqual(['cc_oct:new', 'cc_jan:new', 'cc_today:opened']);
    expect(told).toBe(1);
    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual([
      'wordOfTheDay',
      'curatedCollections',
    ]);
    expect([...records.keys()]).toContain('curatedCollections.opened.cc_today');

    const { app: reopened } = await run({ records });
    expect(idsOf(reopened)).toEqual(['cc_oct:new', 'cc_jan:new', 'cc_today:opened']);
  });

  it('opens an unknown or already opened collection without a change', async () => {
    const { app, records } = await run();
    await app.curatedCollections.open('cc_today');
    const before = app.curatedCollections.rail;

    await app.curatedCollections.open('cc_today');
    await app.curatedCollections.open('cc_none');

    expect(app.curatedCollections.rail).toBe(before);
    expect([...records.keys()].filter((key) => key.startsWith('curatedCollections.'))).toEqual([
      'curatedCollections.opened.cc_today',
    ]);
  });

  it('shows ten collections at most', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      collection(`cc_${String(i).padStart(2, '0')}`, `2026-01-${String(i + 1).padStart(2, '0')}`),
    );
    const { app } = await run({ curatedCollections: many });

    expect(app.curatedCollections.rail).toHaveLength(10);
    expect(idsOf(app)[0]).toBe('cc_11:new');
    expect(idsOf(app)).not.toContain('cc_00:new');
  });

  it('has no rail and no block with `curatedCollections` off', async () => {
    const { app } = await run({ on: ['wordOfTheDay', 'dashboard'] });

    expect(app.curatedCollections.rail).toEqual([]);
    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual(['wordOfTheDay']);
  });

  it('has no block when nothing is published yet', async () => {
    const { app } = await run({ curatedCollections: [collection('cc_later', '2027-01-01')] });

    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual(['wordOfTheDay']);
  });
});

describe('A Curated Collection screen', () => {
  const picks: CuratedCollection = {
    id: 'cc_picks',
    name: 'Добірка',
    description: 'Про добірку',
    publishedOn: '2026-11-01',
    entryIds: ['w_three', 'w_old', 'w_one', 'w_two'],
  };

  async function runPicks(records = new Map<string, string>()) {
    let draws = 0;
    const time = fakeClock('2026-11-04T09:00:00+02:00');
    const app = await openComposition({
      content: createMemoryContentPort({
        words: [word('w_one'), word('w_two'), word('w_three'), word('w_old', { retired: true })],
        curatedCollections: [picks],
      }),
      edition: testEdition({
        isFeatureEnabled: (feature) =>
          ['wordOfTheDay', 'dashboard', 'curatedCollections', 'knowledge'].includes(feature),
      }),
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: time.clock,
      // A new value each call, so a second Collection gets a free id.
      random: { next: () => (draws = (draws + 0.37) % 1) },
    });
    return { app, records };
  }

  it('shows the name, the description and the live Entries in order, «Знаю 0 з 3»', async () => {
    const { app } = await runPicks();
    const screen = await app.curatedCollections.screen('cc_picks');

    expect(screen?.collection.name).toBe('Добірка');
    expect(screen?.collection.description).toBe('Про добірку');
    expect(screen?.entries.map(({ entryId, known }) => `${entryId}:${String(known)}`)).toEqual([
      'w_three:false',
      'w_one:false',
      'w_two:false',
    ]);
    expect(screen && { known: screen.known, total: screen.total }).toEqual({ known: 0, total: 3 });
    expect(screen?.added).toBe(false);
  });

  it('counts a Known tap at once, and leaves a Hidden Entry out of N', async () => {
    const { app } = await runPicks();
    let told = 0;
    app.curatedCollections.subscribe(() => (told += 1));

    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('w_two', 'unknown');
    await settle();
    expect(told).toBeGreaterThan(0);
    const marked = await app.curatedCollections.screen('cc_picks');
    expect(marked && { known: marked.known, total: marked.total }).toEqual({ known: 1, total: 3 });

    await app.hiddenEntries.hide('w_three');
    await settle();
    const hidden = await app.curatedCollections.screen('cc_picks');
    expect(hidden?.entries.map(({ entryId }) => entryId)).toEqual(['w_one', 'w_two']);
    expect(hidden && { known: hidden.known, total: hidden.total }).toEqual({ known: 1, total: 2 });
  });

  it('is nothing for an unknown or unpublished id', async () => {
    const { app } = await runPicks();
    expect(await app.curatedCollections.screen('cc_none')).toBeUndefined();
  });

  it('opening an Entry from it makes nothing Seen and writes nothing', async () => {
    const { app, records } = await runPicks();
    const before = new Map(records);
    const history = app.history.list;
    const screen = await app.curatedCollections.screen('cc_picks');
    const entryId = screen?.entries[0]?.entryId ?? '';

    expect((await app.entryCard(entryId))?.entryId).toBe(entryId);
    expect(app.history.list).toBe(history);
    expect(records).toEqual(before);
  });

  it('«+ Додати» copies it into Collections with its source, Retired skipped, then «Додано ✓»', async () => {
    const { app, records } = await runPicks();

    const copy = await app.curatedCollections.add('cc_picks');

    expect(copy?.name).toBe('Добірка');
    expect(copy?.source).toBe('cc_picks');
    expect(app.collections.list).toContainEqual(copy);
    expect(app.collections.entries(copy?.id ?? '').map(({ entryId }) => entryId)).toEqual([
      'w_three',
      'w_one',
      'w_two',
    ]);
    expect((await app.curatedCollections.screen('cc_picks'))?.added).toBe(true);
    expect(app.curatedCollections.rail.map(({ added }) => added)).toEqual([true]);

    // Again, it makes no second copy.
    expect(await app.curatedCollections.add('cc_picks')).toBeUndefined();
    expect(app.collections.list).toHaveLength(1);

    // The source is kept: the next app run still shows «Додано ✓».
    const next = await runPicks(records);
    expect(next.app.curatedCollections.rail[0]?.added).toBe(true);
  });

  it('copies under the duplicate-name rule, and is «Додати» again once the copy is deleted', async () => {
    const { app } = await runPicks();
    await app.collections.create('Добірка');

    const copy = await app.curatedCollections.add('cc_picks');
    expect(copy?.name).toBe('Добірка (2)');

    await app.collections.delete(copy?.id ?? '');
    await settle();
    expect(app.curatedCollections.rail[0]?.added).toBe(false);
    expect((await app.curatedCollections.screen('cc_picks'))?.added).toBe(false);
  });
});
