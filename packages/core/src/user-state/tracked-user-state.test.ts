import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  createSettings,
  openComposition,
  openUserState,
  trackChanges,
  userStateRecords,
  type UserStateChanges,
  type UserStatePort,
} from '../index';
import { fakeClock, word } from '../test-support';

const {
  activeDays,
  collections,
  favorites,
  feedPosition,
  fontSize,
  gameBest,
  notificationTimes,
  syncCursor,
  theme,
  vibration,
} = userStateRecords;

/** A tracked user state over records in memory, with the batches its port was handed. */
async function tracked(records = new Map<string, string>(), port?: UserStatePort) {
  const time = fakeClock('2026-10-18T09:00:00.000Z');
  const memory = port ?? createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  const userState = await openUserState({
    port: { ...memory, write: (changes) => (writes.push(changes), memory.write(changes)) },
  });
  writes.length = 0;
  return { userState: trackChanges({ userState, clock: time.clock }), records, writes, time };
}

// Spec #378, "The device side": every write of a synced record leaves its pending change.
describe('the tracked user state', () => {
  it('writes the pending change of a synced record, with the clock’s time, in the same batch', async () => {
    const { userState, writes } = await tracked();

    await userState.write(favorites.record('w_1').change('2026-10-18T08:59:00.000Z'));

    expect(writes).toEqual([
      new Map([
        ['favorites.w_1', '"2026-10-18T08:59:00.000Z"'],
        [
          'sync.pending.favorites.w_1',
          '{"changedAt":"2026-10-18T09:00:00.000Z","value":"\\"2026-10-18T08:59:00.000Z\\""}',
        ],
      ]),
    ]);
    expect(await userState.pendingChanges()).toEqual(
      new Map([
        [
          'favorites.w_1',
          {
            changedAt: new Date('2026-10-18T09:00:00.000Z'),
            value: '"2026-10-18T08:59:00.000Z"',
          },
        ],
      ]),
    );
  });

  it('replaces the pending change of a key with the next write of it', async () => {
    const { userState, time } = await tracked();

    await userState.write(theme.change('dark'));
    time.advance(60_000);
    await userState.write(theme.change('light'));

    expect(await userState.pendingChanges()).toEqual(
      new Map([
        ['settings.theme', { changedAt: new Date('2026-10-18T09:01:00.000Z'), value: '"light"' }],
      ]),
    );
  });

  it('writes a tombstone for a deletion', async () => {
    const { userState, records } = await tracked(
      new Map([['favorites.w_1', '"2026-10-17T08:00:00.000Z"']]),
    );

    await userState.write(favorites.record('w_1').change(undefined));

    expect(records.has('favorites.w_1')).toBe(false);
    expect(await userState.pendingChanges()).toEqual(
      new Map([
        ['favorites.w_1', { changedAt: new Date('2026-10-18T09:00:00.000Z'), value: undefined }],
      ]),
    );
  });

  it('tracks every synced record of a batch, the Active Days and the best Game result too', async () => {
    const { userState } = await tracked();

    await userState.write(
      new Map([
        ...activeDays.record('2026-10-18').change(true),
        ...gameBest.change(9),
        ...collections
          .record('k_1')
          .change({ name: 'Море', createdAt: '2026-10-18T09:00:00.000Z' }),
      ]),
    );

    expect([...(await userState.pendingChanges()).keys()].sort()).toEqual([
      'activeDays.2026-10-18',
      'collections.k_1',
      'game.best',
    ]);
  });

  it('writes no pending change for a `device-only` record, the schema version, a pending change or the cursor', async () => {
    const { userState, writes } = await tracked();
    const batch = new Map([
      ...vibration.change(false),
      ...notificationTimes.change(['09:00']),
      ...feedPosition.change({ entryId: 'w_1', date: '2026-10-18' }),
      ['schema.version', '4'],
      ['sync.pending.favorites.w_1', '{"changedAt":"2026-10-18T08:00:00.000Z","value":null}'],
      ...syncCursor.change(42),
    ]);

    await userState.write(batch);

    expect(writes).toEqual([batch]);
    expect(await userState.cursor()).toBe(42);
  });

  it('leaves no pending change when the write fails', async () => {
    const records = new Map<string, string>();
    const memory = createMemoryUserStatePort(records);
    let failing = false;
    const { userState } = await tracked(records, {
      ...memory,
      write: (changes) =>
        failing ? Promise.reject(new Error('disk full')) : memory.write(changes),
    });
    failing = true;

    await expect(userState.write(theme.change('dark'))).rejects.toThrow('disk full');

    failing = false;
    expect(await userState.pendingChanges()).toEqual(new Map());
    // The failure holds back no later write.
    await userState.write(theme.change('light'));
    expect([...(await userState.pendingChanges()).keys()]).toEqual(['settings.theme']);
  });

  it('back-fills nothing for the records written before 0.8, and has no cursor before a sync', async () => {
    const { userState } = await tracked(
      new Map([
        ['schema.version', '3'],
        ['favorites.w_1', '"2026-10-17T08:00:00.000Z"'],
        ['settings.theme', '"dark"'],
      ]),
    );

    expect(await userState.pendingChanges()).toEqual(new Map());
    expect(await userState.cursor()).toBeUndefined();
  });

  it('reads and lists as the user state does', async () => {
    const { userState } = await tracked(new Map([['favorites.w_1', '"2026-10-17T08:00:00.000Z"']]));

    expect(await userState.list(favorites)).toEqual(new Map([['w_1', '2026-10-17T08:00:00.000Z']]));
    expect(await userState.read(theme)).toBeUndefined();
  });
});

// Spec #378, "The Sync module (Core)": the tracked user state opens first, so every module writes through it.
describe('the settings and the composition over the tracked user state', () => {
  it('leave a pending change for each synced record they write, and none for a `device-only` one', async () => {
    const { userState, time } = await tracked();
    const settings = createSettings({
      userState,
      defaults: { theme: 'system', fontSize: 'M', vibration: true },
    });
    const app = await openComposition({
      content: createMemoryContentPort({ words: [word('w_one'), word('w_two')], corrections: [] }),
      edition: {
        id: 'test',
        isFeatureEnabled: () => false,
        languageTraits: { distractorRule: 'same-part-of-speech' },
        userSettingDefaults: {
          mix: { categoryIds: ['test'], corrections: false },
          notificationTimes: [],
        },
      },
      userState,
      clock: time.clock,
      random: { next: () => 0.25 },
    });

    await settings.update({ theme: 'dark', vibration: false });
    await app.favorites.add('w_two');
    await app.hide({ kind: 'entry', entryId: 'w_one' });

    const pending = await userState.pendingChanges();
    expect(pending.get('settings.theme')?.value).toBe('"dark"');
    expect(pending.has('favorites.w_two')).toBe(true);
    expect(pending.has('hidden.w_one')).toBe(true);
    // Opening the composition made today an Active Day.
    expect(pending.has('activeDays.2026-10-18')).toBe(true);
    expect(pending.has('settings.vibration')).toBe(false);
    expect(pending.has('feed.wordOfTheDay')).toBe(false);
  });
});

describe('deleting the sent pending changes', () => {
  it('deletes each pending change sent', async () => {
    const { userState } = await tracked();
    await userState.write(new Map([...theme.change('dark'), ...fontSize.change('L')]));

    await userState.deleteSent(await userState.pendingChanges());

    expect(await userState.pendingChanges()).toEqual(new Map());
  });

  it('keeps a newer change of a key written after the one sent', async () => {
    const { userState, time } = await tracked();
    await userState.write(new Map([...theme.change('dark'), ...fontSize.change('L')]));
    const sent = await userState.pendingChanges();
    time.advance(1_000);
    await userState.write(theme.change('light'));

    await userState.deleteSent(sent);

    expect(await userState.pendingChanges()).toEqual(
      new Map([
        ['settings.theme', { changedAt: new Date('2026-10-18T09:00:01.000Z'), value: '"light"' }],
      ]),
    );
  });

  it('keeps a newer change written in the same instant as the one sent', async () => {
    const { userState } = await tracked();
    await userState.write(theme.change('dark'));
    const sent = await userState.pendingChanges();
    await userState.write(theme.change('light'));

    await userState.deleteSent(sent);

    expect((await userState.pendingChanges()).get('settings.theme')?.value).toBe('"light"');
  });

  it('keeps a newer change written while the deletion runs', async () => {
    const { userState, time } = await tracked();
    await userState.write(theme.change('dark'));
    const sent = await userState.pendingChanges();
    time.advance(1_000);

    await Promise.all([userState.deleteSent(sent), userState.write(theme.change('light'))]);

    expect((await userState.pendingChanges()).get('settings.theme')?.value).toBe('"light"');
  });

  it('writes nothing when nothing sent is still pending', async () => {
    const { userState, writes } = await tracked();

    await userState.deleteSent(
      new Map([
        ['settings.theme', { changedAt: new Date('2026-10-18T08:00:00.000Z'), value: '"dark"' }],
      ]),
    );

    expect(writes).toEqual([]);
  });
});
