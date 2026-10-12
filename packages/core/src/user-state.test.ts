import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  createSettings,
  createSwipeHint,
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
