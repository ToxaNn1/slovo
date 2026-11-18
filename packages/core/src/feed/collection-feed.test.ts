import type { CuratedCollection } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type CuratedCollectionScreen } from '../index';
import { createMemoryContentPort } from '../testing';
import {
  correction,
  fakeClock,
  idiom,
  settle,
  synonymRow,
  testEdition,
  tip,
  word,
} from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { collectionFeedPage } from './collection-feed';

const picks: CuratedCollection = {
  id: 'cc_picks',
  name: 'Добірка',
  description: 'Про добірку',
  publishedOn: '2026-11-01',
  retired: false,
  entryIds: ['w_one', 'c_one', 'w_old', 'i_one', 's_one', 't_one', 'w_hidden'],
};

async function run() {
  const records = new Map<string, string>();
  const app = await openComposition({
    content: createMemoryContentPort({
      words: [word('w_one'), word('w_old', { retired: true }), word('w_hidden')],
      corrections: [correction('c_one')],
      idioms: [idiom('i_one')],
      synonymRows: [synonymRow('s_one')],
      tips: [tip('t_one')],
      curatedCollections: [picks],
    }),
    edition: testEdition({
      isFeatureEnabled: (feature) => ['wordOfTheDay', 'curatedCollections'].includes(feature),
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock('2026-11-04T09:00:00+02:00').clock,
    random: { next: () => 0.25 },
  });
  await app.hiddenEntries.hide('w_hidden');
  await settle();
  return { app, records };
}

async function screenOf(app: Awaited<ReturnType<typeof run>>['app']) {
  const screen = await app.curatedCollections.screen('cc_picks');
  if (screen === undefined) throw new Error('The collection has no screen');
  return screen;
}

const pagesOf = (screen: CuratedCollectionScreen, from: string, count: number) =>
  Array.from({ length: count }, (_, position) => {
    const page = collectionFeedPage(screen, from, position);
    return page && `${page.entryId} ${String(page.place)}/${String(page.of)}`;
  });

describe("A Curated Collection's Feed", () => {
  it('pages over the live Entries of every kind in its order, from the tapped one and round again', async () => {
    const { app } = await run();
    const screen = await screenOf(app);

    expect(pagesOf(screen, 'i_one', 7)).toEqual([
      'i_one 1/5',
      's_one 2/5',
      't_one 3/5',
      'w_one 4/5',
      'c_one 5/5',
      'i_one 1/5',
      's_one 2/5',
    ]);
  });

  it('leaves the Retired and the Hidden Entries out', async () => {
    const { app } = await run();
    const shown = pagesOf(await screenOf(app), 'w_one', 10).join(' ');

    expect(shown).toContain('c_one');
    expect(shown).not.toContain('w_old');
    expect(shown).not.toContain('w_hidden');
  });

  it('opens on the first Entry when the tapped one is no longer shown', async () => {
    const { app } = await run();

    expect(pagesOf(await screenOf(app), 'w_hidden', 1)).toEqual(['w_one 1/5']);
  });

  it('makes nothing Seen and leaves History untouched while its cards open', async () => {
    const { app, records } = await run();
    const before = new Map(records);
    const history = app.history.list;
    const screen = await screenOf(app);

    for (let position = 0; position < 6; position += 1) {
      const page = collectionFeedPage(screen, 'w_one', position);
      expect((await app.entryCard(page?.entryId ?? ''))?.entryId).toBe(page?.entryId);
    }
    await settle();

    expect(app.history.list).toBe(history);
    expect(records).toEqual(before);
  });
});
