import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  createSettings,
  createSwipeHint,
  openUserState,
  type UserStateChanges,
} from '../index';
import { openCycle } from '../feed/cycle';
import { openWordOfTheDay } from '../feed/word-of-the-day';
import { userStateRecords } from './user-state-schema';

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
    const settings = createSettings({
      userState,
      defaults: { theme: 'system', fontSize: 'M', vibration: true, dailyLimit: 'off' },
    });
    const cycle = await openCycle({
      entries: {
        eligible: () =>
          Promise.resolve({ words, corrections: [], idioms: [], synonymRows: [], tips: [] }),
      },
      userState,
      random: { next: () => 0.5 },
    });
    const wordOfTheDay = await openWordOfTheDay({ cycle, userState, clock });

    expect(await settings.read()).toEqual({
      theme: 'dark',
      fontSize: 'L',
      vibration: true,
      noCounters: false,
      selfCheck: false,
      seasonalDecor: true,
      shareCounters: true,
      dailyLimit: 'off',
    });
    expect(await createSwipeHint({ userState }).isDue()).toBe(false);
    expect(new Set(cycle.unseen().words)).toEqual(new Set(['w_0', 'w_3', 'w_4']));
    expect(wordOfTheDay.chosen()?.wordId).toBe('w_3');
  });

  it('splits the Seen array 0.2 kept into one record per Entry, Seen in the Cycle that opens', async () => {
    const records = new Map([
      ['schema.version', '1'],
      ['feed.seen', '["w_1","w_2"]'],
    ]);

    await openUserState({ port: createMemoryUserStatePort(records) });

    expect(records.has('feed.seen')).toBe(false);
    expect(await createMemoryUserStatePort(records).list('feed.seen.')).toEqual(
      new Map([
        ['feed.seen.w_1', '1'],
        ['feed.seen.w_2', '1'],
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

  it('reads the user state a 0.7 app kept: Seen in the current Cycle stays Seen, and the install is marked, each step in one write with its version', async () => {
    // The Seen records exactly as 0.7 wrote them, at schema version 3.
    const records = new Map([
      ['schema.version', '3'],
      ['feed.cycle', '{"id":4,"seed":7}'],
      ['feed.seen.w_1', 'true'],
      ['feed.seen.c_1', 'true'],
      ['favorites.w_2', '"2026-10-17T08:00:00.000Z"'],
    ]);
    const port = createMemoryUserStatePort(records);
    const writes: UserStateChanges[] = [];

    const userState = await openUserState({
      port: { ...port, write: (changes) => (writes.push(changes), port.write(changes)) },
    });
    const cycle = await openCycle({
      entries: {
        eligible: () =>
          Promise.resolve({
            words: ['w_1', 'w_2'],
            corrections: ['c_1', 'c_2'],
            idioms: [],
            synonymRows: [],
            tips: [],
          }),
      },
      userState,
      random: { next: () => 0.5 },
    });

    expect(writes).toEqual([
      new Map([
        ['feed.seen.w_1', '4'],
        ['feed.seen.c_1', '4'],
        ['schema.version', '4'],
      ]),
      new Map([
        ['app.installed', 'true'],
        ['schema.version', '5'],
      ]),
      new Map([['schema.version', '6']]),
    ]);
    expect(cycle.unseen()).toEqual({
      words: ['w_2'],
      corrections: ['c_2'],
      idioms: [],
      synonymRows: [],
      tips: [],
    });
    expect(records.get('favorites.w_2')).toBe('"2026-10-17T08:00:00.000Z"');
  });

  it('gives Seen records the first Cycle when 0.7 kept no Cycle that reads, as the Cycle that opens is the first', async () => {
    for (const cycle of [undefined, 'not JSON', '{"id":4}']) {
      const records = new Map([
        ['schema.version', '3'],
        ['feed.seen.w_1', 'true'],
      ]);
      if (cycle !== undefined) records.set('feed.cycle', cycle);

      await openUserState({ port: createMemoryUserStatePort(records) });

      expect(records.get('feed.seen.w_1'), cycle).toBe('1');
    }
  });

  it('makes the single best result a 0.8.11 app kept the Best result of «Вгадай слово», waiting to sync, in one write with its version', async () => {
    const records = new Map([
      ['schema.version', '5'],
      ['app.installed', 'true'],
      ['game.best', '9'],
    ]);
    const port = createMemoryUserStatePort(records);
    const writes: UserStateChanges[] = [];

    const userState = await openUserState({
      port: { ...port, write: (changes) => (writes.push(changes), port.write(changes)) },
    });

    expect(writes).toEqual([
      new Map([
        ['game.best.guess-word', '9'],
        [
          'sync.pending.game.best.guess-word',
          '{"changedAt":"1970-01-01T00:00:00.000Z","value":"9"}',
        ],
        ['schema.version', '6'],
      ]),
    ]);
    expect(await userState.read(userStateRecords.gameBest.record('guess-word'))).toBe(9);
    expect(await userState.read(userStateRecords.gameBest.record('correction'))).toBeUndefined();
  });

  it('gives «Вгадай слово» no Best result when 0.8.11 kept none, or one that does not read', async () => {
    for (const best of [undefined, 'not JSON', '16', '"9"']) {
      const records = new Map([['schema.version', '5']]);
      if (best !== undefined) records.set('game.best', best);

      await openUserState({ port: createMemoryUserStatePort(records) });

      expect(
        [...records.keys()].filter((key) => key.includes('game.best.')),
        best,
      ).toEqual([]);
      expect(records.get('schema.version')).toBe('6');
    }
  });
});
