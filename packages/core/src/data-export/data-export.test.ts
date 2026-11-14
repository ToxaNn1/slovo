import { describe, expect, it } from 'vitest';

import { DATA_EXPORT_VERSION, openComposition } from '../index';
import { createFakeNotificationScheduler, createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const INSTALL_ID = 'install-7f3a9c';

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: [word('w_ava'), word('w_bura'), word('w_vyr')],
});

/** The Data export of the user state kept as the records, made at 12:00 on 14.11.2026, offline and signed out. */
async function exportOf(records: Map<string, string>) {
  const time = fakeClock('2026-11-14T12:00:00+02:00');
  // Opened first, so the records are kept at the current schema, as a device keeps them.
  const userState = await openUserState({ port: createMemoryUserStatePort() });
  await userState.write(records);
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: () => true }),
    userState,
    clock: time.clock,
    random: { next: () => 0.25 },
    scheduling: {
      scheduler: createFakeNotificationScheduler(),
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Farewell',
      streakWarning: 'Streak warning',
      goalNotMet: 'Goal not met',
    },
  });
  const exported = await app.dataExport();
  await app.close();
  return exported;
}

const kept = (records: Record<string, unknown>) =>
  new Map(Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)]));

describe('the Data export', () => {
  const readerState = kept({
    'settings.readerName': 'Оксана',
    'settings.theme': 'dark',
    'settings.selfCheck': true,
    'favorites.w_ava': '2026-11-01T10:00:00.000Z',
    'collections.c1': { name: 'Мої', createdAt: '2026-11-02T10:00:00.000Z' },
    'collectionEntries.c1.w_bura': '2026-11-03T10:00:00.000Z',
    'history.w_vyr': { seenAt: '2026-11-04T10:00:00.000Z', wordOfTheDay: true },
    'knowledge.w_bura': {
      mark: 'unknown',
      step: 3,
      reviewDay: '2026-11-17',
      learned: false,
      markedAt: '2026-11-05T10:00:00.000Z',
    },
    'confirmed.w_ava': '2026-11-06T10:00:00.000Z',
    'activeDays.2026-11-13': true,
    'xp.x1': {
      kind: 'xp',
      date: '2026-11-13',
      at: '2026-11-13T09:00:00.000Z',
      amount: 5,
      source: 'seen-word',
    },
    'game.best.classic': 7,
    'edition.installId': INSTALL_ID,
    'sync.cursor': 42,
  });

  it("holds the reader's words, progress, settings and name, each Entry by id and Lemma", async () => {
    const exported = await exportOf(readerState);

    expect(exported.reader).toEqual({ name: 'Оксана' });
    expect(exported.settings).toEqual({ theme: 'dark', selfCheck: true });
    expect(exported.favorites).toEqual([
      { entryId: 'w_ava', lemma: 'ava', addedAt: '2026-11-01T10:00:00.000Z' },
    ]);
    expect(exported.collections).toEqual([
      {
        id: 'c1',
        name: 'Мої',
        createdAt: '2026-11-02T10:00:00.000Z',
        entries: [{ entryId: 'w_bura', lemma: 'bura', addedAt: '2026-11-03T10:00:00.000Z' }],
      },
    ]);
    expect(exported.history).toEqual([
      { entryId: 'w_vyr', lemma: 'vyr', seenAt: '2026-11-04T10:00:00.000Z', wordOfTheDay: true },
    ]);
    expect(exported.knowledgeMarks).toEqual([
      {
        entryId: 'w_bura',
        lemma: 'bura',
        mark: 'unknown',
        learned: false,
        reviewDay: '2026-11-17',
        markedAt: '2026-11-05T10:00:00.000Z',
      },
    ]);
    expect(exported.progress.activeDays).toEqual(['2026-11-13']);
    expect(exported.progress.xpLog).toMatchObject([{ id: 'x1', amount: 5, date: '2026-11-13' }]);
    expect(exported.progress.confirmed).toEqual([
      { entryId: 'w_ava', lemma: 'ava', confirmedAt: '2026-11-06T10:00:00.000Z' },
    ]);
    expect(exported.progress.gameBest).toEqual({ classic: 7 });
  });

  it('never holds the Install id, the Sync state or the Entries’ content', async () => {
    const text = JSON.stringify(await exportOf(readerState));

    expect(text).not.toContain(INSTALL_ID);
    expect(text).not.toContain('cursor');
    expect(text).not.toContain('The meaning of');
    expect(text).not.toMatch(/session|token/i);
  });

  it('carries its format, version, Edition and the time it was made', async () => {
    const exported = await exportOf(readerState);

    expect(exported).toMatchObject({
      format: 'slovo-data-export',
      version: DATA_EXPORT_VERSION,
      edition: testEdition().id,
      exportedAt: '2026-11-14T10:00:00.000Z',
    });
  });

  it('names an Entry the Language Pack no longer has by its id alone', async () => {
    const exported = await exportOf(kept({ 'favorites.w_gone': '2026-11-01T10:00:00.000Z' }));

    expect(exported.favorites).toEqual([
      { entryId: 'w_gone', lemma: null, addedAt: '2026-11-01T10:00:00.000Z' },
    ]);
  });

  it('of a fresh install is a valid, nearly empty JSON document', async () => {
    const exported = await exportOf(new Map());

    expect(JSON.parse(JSON.stringify(exported))).toEqual({
      format: 'slovo-data-export',
      version: DATA_EXPORT_VERSION,
      edition: testEdition().id,
      exportedAt: '2026-11-14T10:00:00.000Z',
      reader: { name: null },
      settings: {},
      favorites: [],
      collections: [],
      history: [],
      knowledgeMarks: [],
      progress: { activeDays: [], xpLog: [], confirmed: [], gameBest: {} },
    });
  });
});
