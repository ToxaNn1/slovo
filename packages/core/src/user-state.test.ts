import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createMemoryUserStatePort,
  createSettings,
  createSwipeHint,
  declareRecord,
  declareRecords,
  openCycle,
  openUserState,
  openWordOfTheDay,
} from './index';

// The contract suite in apps/mobile covers migrations on every adapter; these
// cover what only the Core decides.
describe('openUserState', () => {
  it('refuses a schema version it cannot read, rather than migrating again', async () => {
    const records = new Map([['schema.version', 'two']]);
    const migrate = () => Promise.resolve(new Map([['migrated', 'again']]));

    await expect(
      openUserState({
        port: createMemoryUserStatePort(records),
        migrations: [{ version: 1, migrate }],
      }),
    ).rejects.toThrow(/schema version/);
    expect(records.has('migrated')).toBe(false);
  });

  it('rejects migrations that skip a version', async () => {
    const migrate = () => Promise.resolve(new Map());

    await expect(
      openUserState({ port: createMemoryUserStatePort(), migrations: [{ version: 2, migrate }] }),
    ).rejects.toThrow(/version 2/);
  });

  it('reads the user state a 0.2 app kept', async () => {
    // The records exactly as 0.2 wrote them.
    const records = new Map([
      ['schema.version', '1'],
      ['settings.theme', 'dark'],
      ['settings.fontSize', 'L'],
      ['feed.swipeHintShown', 'true'],
      ['feed.cycle', '{"id":2,"seed":7}'],
      ['feed.seen', '["w_1","w_2"]'],
      ['feed.wordOfTheDay', '{"entryId":"w_3","date":"2026-10-11"}'],
    ]);
    const words = ['w_0', 'w_1', 'w_2', 'w_3', 'w_4'];
    const clock = {
      now: () => new Date('2026-10-11T09:00:00+03:00'),
      timeZone: () => 'Europe/Kyiv',
    };

    const userState = await openUserState({ port: createMemoryUserStatePort(records) });
    const settings = createSettings({ userState, defaults: { theme: 'system', fontSize: 'M' } });
    const cycle = await openCycle({
      entries: { eligible: () => Promise.resolve({ words, corrections: [] }) },
      userState,
      random: { next: () => 0.5 },
    });
    const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });

    expect(await settings.read()).toEqual({ theme: 'dark', fontSize: 'L' });
    expect(await createSwipeHint({ userState }).isDue()).toBe(false);
    expect(new Set(cycle.unseen().words)).toEqual(new Set(['w_0', 'w_3', 'w_4']));
    expect(wordOfTheDay.chosen()?.wordId).toBe('w_3');
  });

  it('splits the Seen array 0.2 kept into one record per Entry', async () => {
    const records = new Map([
      ['schema.version', '1'],
      ['feed.seen', '["w_1","w_2"]'],
    ]);

    await openUserState({ port: createMemoryUserStatePort(records) });

    expect(records.has('feed.seen')).toBe(false);
    expect(await createMemoryUserStatePort(records).list('feed.seen.')).toEqual(
      new Map([
        ['feed.seen.w_1', 'true'],
        ['feed.seen.w_2', 'true'],
      ]),
    );
  });

  it('drops a Seen array that is not one, as 0.2 would have read nothing Seen from it', async () => {
    const records = new Map([
      ['schema.version', '2'],
      ['feed.seen', '{"w_1":true}'],
    ]);

    await openUserState({ port: createMemoryUserStatePort(records) });

    expect([...records.keys()].filter((key) => key.startsWith('feed.seen'))).toEqual([]);
  });
});

describe('the user-state records', () => {
  const FavoriteSchema = z.object({ addedAt: z.number() });

  it('reads back the value a record keeps, and nothing once it is deleted', async () => {
    const record = declareRecord('test.favorite', FavoriteSchema);
    const userState = await openUserState({ port: createMemoryUserStatePort() });

    await userState.write(record.change({ addedAt: 1 }));
    expect(await userState.read(record)).toEqual({ addedAt: 1 });

    await userState.write(record.change(undefined));
    expect(await userState.read(record)).toBeUndefined();
  });

  it('reads nothing from a record that holds no value of its schema', async () => {
    const records = new Map([
      ['test.notJson', '{'],
      ['test.otherShape', '{"addedAt":"yesterday"}'],
    ]);
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });

    expect(await userState.read(declareRecord('test.notJson', FavoriteSchema))).toBeUndefined();
    expect(await userState.read(declareRecord('test.otherShape', FavoriteSchema))).toBeUndefined();
  });

  it('lists the records of a kind by id, leaving out any that holds no value of its schema', async () => {
    const favorites = declareRecords('test.favorites.', FavoriteSchema);
    const records = new Map([
      ['test.favorites.w_3', 'not JSON'],
      ['test.favoritesw_4', '{"addedAt":4}'],
    ]);
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });

    await userState.write(
      new Map([
        ...favorites.record('w_1').change({ addedAt: 1 }),
        ...favorites.record('w_2').change({ addedAt: 2 }),
      ]),
    );

    expect(await userState.list(favorites)).toEqual(
      new Map([
        ['w_1', { addedAt: 1 }],
        ['w_2', { addedAt: 2 }],
      ]),
    );
    expect(await userState.read(favorites.record('w_2'))).toEqual({ addedAt: 2 });
  });
});
