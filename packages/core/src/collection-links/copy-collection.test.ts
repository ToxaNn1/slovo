import type { CollectionLink, FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemorySessionStore,
  openAccount,
  openComposition,
  openSync,
  type Composition,
  type TrackedUserState,
} from '../index';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  createMemoryContentPort,
} from '../testing';
import {
  correction,
  fakeClock,
  randomOf,
  steppingRandom,
  testEdition,
  testSchedule,
  word,
} from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { trackChanges } from '../user-state/tracked-user-state';
import { userStateRecords } from '../user-state/user-state-schema';

const content = createMemoryContentPort({
  words: [
    word('w_one'),
    word('w_two'),
    word('w_three'),
    word('w_four'),
    word('w_five'),
    word('w_six'),
    word('w_old', { retired: true }),
  ],
  corrections: [correction('c_one')],
});

/** An id no link was made with. */
const UNKNOWN_ID = 'Ab3dE5gH9k';

/** A Collection Link of the test Edition, as the backend stores it. */
const link = (name: string, entryIds: string[]): CollectionLink => ({
  edition: 'test',
  name,
  entryIds,
});

/**
 * The Core of a reader with no Account over a fake Collection Link backend,
 * with the switches of the Edition on unless the test turns some off.
 */
async function reader({
  off = [],
  userState,
  schedule,
}: {
  off?: FeatureSwitch[];
  userState?: TrackedUserState;
  schedule?: ReturnType<typeof testSchedule>['schedule'];
} = {}) {
  const api = createFakeBackend();
  const switchedOff = new Set<FeatureSwitch>(off);
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => feature !== 'knowledge' && !switchedOff.has(feature),
    }),
    userState: userState ?? (await openUserState({ port: createMemoryUserStatePort(new Map()) })),
    clock: fakeClock().clock,
    random: steppingRandom(),
    backend: api.backend,
    ...(schedule === undefined ? {} : { schedule }),
  });
  /** Shares the link as its author would, and answers its id. */
  async function share(shared: CollectionLink): Promise<string> {
    const made = await api.backend.collectionLinks.create(shared);
    return made.id;
  }
  return { app, api, share };
}

/** Opens the preview of the link, which must be available. */
async function open(app: Composition, id: string) {
  const opened = await app.collectionLinkCopy.preview(id);
  if (!opened.ok) throw new Error(`The link was not available: ${opened.reason}`);
  return opened;
}

/** Opens the preview of the link, which must be available with something to copy. */
async function preview(app: Composition, id: string) {
  const opened = await open(app, id);
  const { add } = opened;
  if (add === undefined) throw new Error('The link had nothing to copy');
  return { ...opened, add };
}

/** The Entry ids of the Collection, as its screen lists them. */
const entryIdsOf = (app: Composition, collectionId: string) =>
  app.collections.entries(collectionId).map(({ entryId }) => entryId);

// Spec #937, Collection Links: the recipient sheet and «Додати собі» (ADR 0058).
describe('a Collection Link', () => {
  it('previews the name, how many Entries it holds and its first 5 the Language Pack has', async () => {
    const { app, api, share } = await reader();
    const id = await share(
      link('Осінь', ['w_six', 'w_gone', 'c_one', 'w_one', 'w_old', 'w_two', 'w_three']),
    );

    const opened = await preview(app, id);

    expect(opened.name).toBe('Осінь');
    expect(opened.count).toBe(7);
    expect(opened.firstEntries.map(({ entryId }) => entryId)).toEqual([
      'w_six',
      'c_one',
      'w_one',
      'w_old',
      'w_two',
    ]);
    expect(opened.firstEntries[1]?.title).toBe('one');
    expect(opened.skipped).toBe(1);
    // The author's share, and the reader's one read.
    expect(api.calls).toHaveLength(2);
  });

  it('copies into a new Collection of the reader with its name and its Entries in its order', async () => {
    const { app, share } = await reader();
    const id = await share(link('Осінь', ['w_three', 'c_one', 'w_one', 'w_old']));

    const copy = await (await preview(app, id)).add();

    expect(copy).toMatchObject({ name: 'Осінь', count: 4 });
    expect(app.collections.list).toEqual([copy]);
    expect(entryIdsOf(app, copy.id)).toEqual(['w_three', 'c_one', 'w_one', 'w_old']);
  });

  it('numbers the copy (2), (3)… past the names the reader already has, in any letter case', async () => {
    const { app, share } = await reader();
    await app.collections.create('осінь');
    await app.collections.create('Осінь (2)');
    const id = await share(link('Осінь', ['w_one']));
    const opened = await preview(app, id);

    const third = await opened.add();
    const fourth = await opened.add();

    expect(third.name).toBe('Осінь (3)');
    expect(fourth.name).toBe('Осінь (4)');
    expect(app.collections.list).toHaveLength(4);
  });

  it('makes a copy on every tap, of the same link opened twice', async () => {
    const { app, share } = await reader();
    const id = await share(link('Осінь', ['w_one', 'w_two']));

    const first = await (await preview(app, id)).add();
    const second = await (await preview(app, id)).add();

    expect([first.name, second.name]).toEqual(['Осінь', 'Осінь (2)']);
    expect(first.id).not.toBe(second.id);
    expect(entryIdsOf(app, second.id)).toEqual(['w_one', 'w_two']);
  });

  it('cuts a long name so the copy keeps to the 40 characters of a Collection name', async () => {
    const { app, share } = await reader();
    const long = `${'а'.repeat(38)} довга назва`;
    const id = await share(link(long, ['w_one']));
    const opened = await preview(app, id);

    const first = await opened.add();
    const second = await opened.add();

    expect(opened.name).toBe(long);
    expect(first.name).toBe(`${'а'.repeat(38)} д`);
    expect(second.name).toBe(`${'а'.repeat(36)} (2)`);
  });

  it.each([
    [1, ['w_gone']],
    [3, ['w_gone', 'w_lost', 'c_gone']],
    [5, ['w_gone', 'w_lost', 'c_gone', 'i_gone', 't_gone']],
  ])(
    'counts %i Entries missing from the Language Pack and leaves them out of the copy',
    async (skipped, missing) => {
      const { app, share } = await reader();
      const id = await share(link('Осінь', ['w_one', ...missing, 'w_two']));
      const opened = await preview(app, id);

      const copy = await opened.add();

      expect(opened.skipped).toBe(skipped);
      expect(opened.count).toBe(skipped + 2);
      expect(copy.count).toBe(2);
      expect(entryIdsOf(app, copy.id)).toEqual(['w_one', 'w_two']);
    },
  );

  it('offers no copy when the Language Pack has none of its Entries, so no empty Collection', async () => {
    const { app, share } = await reader();
    const id = await share(link('Осінь', ['w_gone', 'c_gone']));

    const opened = await open(app, id);

    expect(opened.count).toBe(2);
    expect(opened.skipped).toBe(2);
    expect(opened.firstEntries).toEqual([]);
    expect(opened.add).toBeUndefined();
    expect(app.collections.list).toEqual([]);
  });

  it('keeps a Hidden Entry in the preview and the copy, still Hidden everywhere else', async () => {
    const { app, share } = await reader();
    await app.hiddenEntries.hide('w_two');
    const id = await share(link('Осінь', ['w_one', 'w_two']));
    const opened = await preview(app, id);

    const copy = await opened.add();

    expect(opened.firstEntries.map(({ entryId }) => entryId)).toEqual(['w_one', 'w_two']);
    expect(opened.skipped).toBe(0);
    expect(entryIdsOf(app, copy.id)).toEqual(['w_one', 'w_two']);
    expect(app.hiddenEntries.has('w_two')).toBe(true);
  });

  it('is not available when the backend has no such link', async () => {
    const { app } = await reader();

    expect(await app.collectionLinkCopy.preview(UNKNOWN_ID)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(app.collections.list).toEqual([]);
  });

  it('is not available when it is a link of another Edition', async () => {
    const { app, share } = await reader();
    const id = await share({ ...link('Осінь', ['w_one']), edition: 'other' });

    expect(await app.collectionLinkCopy.preview(id)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('is not available, asking nothing, for an id no link can have', async () => {
    const { app, api } = await reader();

    expect(await app.collectionLinkCopy.preview('not-an-id')).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(api.calls).toHaveLength(0);
  });

  it('is not available, asking nothing, while collectionLinks is off', async () => {
    const { app, api, share } = await reader({ off: ['collectionLinks'] });
    const id = await share(link('Осінь', ['w_one']));

    expect(await app.collectionLinkCopy.preview(id)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    // The author's share alone.
    expect(api.calls).toHaveLength(1);
  });

  it('says there is no connection when offline, after the tries of the one retry rule', async () => {
    const time = fakeClock();
    const timers = testSchedule(time);
    const { app, api, share } = await reader({ schedule: timers.schedule });
    const id = await share(link('Осінь', ['w_one']));
    api.online = false;

    const opened = app.collectionLinkCopy.preview(id);
    await timers.advance(60_000);

    expect(await opened).toEqual({ ok: false, reason: 'offline' });
    // The author's share, then the reader's try and its 3 tries again.
    expect(api.calls).toHaveLength(5);
    expect(app.collections.list).toEqual([]);
  });

  it('opens once a server error passes on a try again', async () => {
    const time = fakeClock();
    const timers = testSchedule(time);
    const { app, api, share } = await reader({ schedule: timers.schedule });
    const id = await share(link('Осінь', ['w_one']));
    api.failNext('server-error');

    const opened = app.collectionLinkCopy.preview(id);
    await timers.advance(60_000);

    expect(await opened).toMatchObject({ ok: true, name: 'Осінь', count: 1 });
  });

  it('enters the next Sync as a Collection the reader made, with no trace of the link', async () => {
    const time = fakeClock('2026-10-18T09:00:00.000Z');
    const timers = testSchedule(time);
    const server = createFakeBackend({ clock: time.clock });
    const userState = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: time.clock,
    });
    // This install has run before, so the Account keeps the Session it finds.
    await userState.write(userStateRecords.installed.change(true));
    const account = await openAccount({
      backend: server.backend,
      edition: { id: 'uk', isFeatureEnabled: () => false },
      googleSheet: createFakeGoogleSignInSheet(),
      appleSheet: createFakeAppleSignInSheet(),
      userState,
      sessions: createMemorySessionStore({ token: 'a-session', email: 'anna@mail.com' }),
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });
    const sync = await openSync({
      userState,
      backend: server.backend,
      account,
      edition: { id: 'uk', isFeatureEnabled: () => true },
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });
    const { app, share } = await reader({ userState });
    const id = await share(link('Осінь', ['w_one', 'w_two']));

    const copy = await (await preview(app, id)).add();
    sync.foreground();
    await timers.advance(0);

    const kept = [...server.sync.records.keys()].filter((key) => key.startsWith('collection'));
    expect(kept.sort()).toEqual([
      `collectionEntries.${copy.id}.w_one`,
      `collectionEntries.${copy.id}.w_two`,
      `collections.${copy.id}`,
    ]);
    expect(JSON.stringify([...server.sync.records.values()])).not.toContain(id);
  });
});
