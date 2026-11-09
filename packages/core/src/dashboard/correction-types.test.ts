import { describe, expect, it } from 'vitest';

import { openComposition, type FeatureSwitch } from '../index';
import { SEEN_DWELL_MS } from '../feed/feed';
import type { UserStatePort } from '../ports';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, settle, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const content = createMemoryContentPort({
  words: [{ ...word('w_one'), correctionIds: ['c_one'] }, word('w_two'), word('w_three')],
  corrections: [
    correction('c_one', { correctionType: 'surzhyk' }),
    correction('c_two', { correctionType: 'calque' }),
    correction('c_three', { correctionType: 'calque' }),
    correction('c_gone', { correctionType: 'paronym', retired: true }),
  ],
});

/** The Core composition of one app run over the records, the Correction Types on unless said otherwise. */
async function run({
  records = new Map<string, string>(),
  on = ['wordOfTheDay', 'wordOfTheDayArchive', 'dashboard', 'corrections', 'correctionTypes'],
  port = createMemoryUserStatePort(records),
}: { records?: Map<string, string>; on?: FeatureSwitch[]; port?: UserStatePort } = {}) {
  const time = fakeClock('2026-11-04T09:00:00+02:00');
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
      userSettingDefaults: { mix: { corrections: true } },
    }),
    userState: await openUserState({ port }),
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { app, time, records };
}

describe('The Correction Types', () => {
  it('shows a tile per Correction Type with live Corrections, in the contract order, with N and X', async () => {
    const { app } = await run();

    expect(app.correctionTypes.tiles).toEqual([
      { type: 'calque', total: 2, workedThrough: 0 },
      { type: 'surzhyk', total: 1, workedThrough: 0 },
    ]);
    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual([
      'wordOfTheDay',
      'correctionTypes',
    ]);
  });

  it('has no tiles and no block with `correctionTypes` off', async () => {
    const { app } = await run({ on: ['wordOfTheDay', 'dashboard', 'corrections'] });

    expect(app.correctionTypes.tiles).toEqual([]);
    expect(app.dashboard.blocks.map(({ kind }) => kind)).toEqual(['wordOfTheDay']);
    expect(await app.correctionTypes.corrections('calque')).toEqual([]);
  });

  it('carries the Categories of Corrections in pack order with `correctionCategoryScreens` on', async () => {
    const { app } = await run({
      on: ['dashboard', 'corrections', 'correctionTypes', 'correctionCategoryScreens'],
    });
    const categories = await content.listCorrectionCategories();

    expect(categories.length).toBeGreaterThan(0);
    expect(app.dashboard.blocks.find(({ kind }) => kind === 'correctionTypes')).toMatchObject({
      categories,
    });
  });

  it('carries no Categories of Corrections with `correctionCategoryScreens` off', async () => {
    const { app } = await run();

    expect(app.dashboard.blocks.find(({ kind }) => kind === 'correctionTypes')).toMatchObject({
      categories: [],
    });
  });

  it('lists the Corrections of a type in pack order, each with whether it is worked through', async () => {
    const { app } = await run();

    await app.correctionTypes.reveal('c_three');

    const rows = await app.correctionTypes.corrections('calque');
    expect(rows.map(({ correction: { id }, workedThrough }) => [id, workedThrough])).toEqual([
      ['c_two', false],
      ['c_three', true],
    ]);
  });

  it('grows «розібрано» on «Як правильно?», once per Correction, and tells the Dashboard', async () => {
    const { app, records } = await run();
    let told = 0;
    app.correctionTypes.subscribe(() => (told += 1));

    await app.correctionTypes.reveal('c_two');
    await app.correctionTypes.reveal('c_two');

    expect(app.correctionTypes.tiles).toEqual([
      { type: 'calque', total: 2, workedThrough: 1 },
      { type: 'surzhyk', total: 1, workedThrough: 0 },
    ]);
    expect(told).toBe(1);
    expect(records.has('correctionsWorkedThrough.c_two')).toBe(true);
    const block = app.dashboard.blocks.find(({ kind }) => kind === 'correctionTypes');
    expect(block).toMatchObject({
      tiles: [{ type: 'calque', workedThrough: 1 }, { type: 'surzhyk' }],
    });

    const again = await run({ records });
    expect(again.app.correctionTypes.tiles[0]).toEqual({
      type: 'calque',
      total: 2,
      workedThrough: 1,
    });
  });

  it('grows «розібрано» when a Correction is Seen on the Feed', async () => {
    const { app, time } = await run();
    while (!app.feed.cards.some(({ entryId }) => entryId === 'w_one')) await app.feed.next();
    const wordAt = app.feed.cards.findIndex(({ entryId }) => entryId === 'w_one');
    const position = await app.feed.openLinkedCorrection(wordAt, 'c_one');
    if (position === undefined) throw new Error('The Correction did not open');

    await app.feed.show(position);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(undefined);

    expect(app.correctionTypes.tiles).toEqual([
      { type: 'calque', total: 2, workedThrough: 0 },
      { type: 'surzhyk', total: 1, workedThrough: 1 },
    ]);
    const [row] = await app.correctionTypes.corrections('surzhyk');
    expect(row).toMatchObject({ correction: { id: 'c_one' }, workedThrough: true });
  });

  it('reads nothing when a Word is Seen, and a failed read when a Correction is Seen stays inside', async () => {
    const memory = createMemoryUserStatePort();
    let reads = 0;
    let failing = false;
    const port: UserStatePort = {
      ...memory,
      list(prefix) {
        if (!prefix.startsWith('correctionsWorkedThrough.')) return memory.list(prefix);
        reads += 1;
        return failing ? Promise.reject(new Error('The disk is gone')) : memory.list(prefix);
      },
    };
    const { app, time } = await run({ port });
    while (!app.feed.cards.some(({ entryId }) => entryId === 'w_one')) await app.feed.next();
    const wordAt = app.feed.cards.findIndex(({ entryId }) => entryId === 'w_one');
    const readsBefore = reads;
    await app.feed.show(wordAt);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(undefined);
    expect(reads).toBe(readsBefore);

    const position = await app.feed.openLinkedCorrection(wordAt, 'c_one');
    if (position === undefined) throw new Error('The Correction did not open');
    failing = true;
    await app.feed.show(position);
    time.advance(SEEN_DWELL_MS);
    // The Seen that reads and fails rejects nothing: not the Feed, not unhandled.
    await expect(app.feed.show(undefined)).resolves.toBeUndefined();
    await settle();

    expect(reads).toBeGreaterThan(readsBefore);
    expect(app.correctionTypes.tiles).toContainEqual({
      type: 'surzhyk',
      total: 1,
      workedThrough: 0,
    });
  });
});
