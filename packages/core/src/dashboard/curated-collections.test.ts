import type { CuratedCollection } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type FeatureSwitch } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, settle, testEdition, word } from '../test-support';
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
