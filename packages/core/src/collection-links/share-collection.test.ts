import { COLLECTION_LINK_SIZE, type FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openCollectionSharing,
  openComposition,
  openUserState,
} from '../index';
import { createFakeCollectionLinksApi, createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testSchedule, word } from '../test-support';

/** Long enough for every wait between the tries of one request (ADR 0037). */
const ALL_TRIES = 10_000;

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  userSettingDefaults: {
    mix: {
      categoryIds: ['test'],
      correctionCategoryIds: 'all' as const,
      corrections: true,
      idioms: true,
      synonymRows: true,
      tips: true,
    },
    notificationTimes: [],
  },
};

/** Ids of more Words than a link holds. */
const manyIds = Array.from({ length: COLLECTION_LINK_SIZE + 1 }, (_, n) => `w_many${String(n)}`);

const content = createMemoryContentPort({
  words: [
    word('w_kvasha'),
    word('w_buzok'),
    word('w_old', { retired: true }),
    ...manyIds.map((id) => word(id)),
  ],
});

/**
 * The app of the Ukrainian Edition over a fake backend, with
 * `collectionLinks` on unless the test turns it off.
 */
async function device({ off = [] }: { off?: FeatureSwitch[] } = {}) {
  const time = fakeClock('2026-10-28T09:00:00.000Z');
  const timers = testSchedule(time);
  const api = createFakeCollectionLinksApi({ linkDomain: 'slovo.example' });
  const switchedOff = new Set<FeatureSwitch>(off);
  const isFeatureEnabled = (feature: FeatureSwitch) => !switchedOff.has(feature);
  const app = await openComposition({
    content,
    edition: { ...testCategories, isFeatureEnabled },
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: time.clock,
    random: randomOf(0.5),
  });
  const sharing = openCollectionSharing({
    collections: app.collections,
    api,
    edition: { id: 'uk', isFeatureEnabled },
    strings: { message: 'Колекція «{name}» у SLOVO: {url}' },
    schedule: timers.schedule,
    random: randomOf(0.5),
  });

  return {
    api,
    sharing,
    switchedOff,
    /** Creates a Collection with the Entries, added a minute apart in order, and answers its id. */
    async collection(name: string, entryIds: readonly string[] = []) {
      const created = await app.collections.create(name);
      if (!created.ok) throw new Error(`"${name}" was refused: ${created.reason}`);
      for (const entryId of entryIds) {
        time.advance(60_000);
        await app.collections.add(created.collection.id, entryId);
      }
      return created.collection.id;
    },
    /** Adds the Entry to the Collection a minute later. */
    async add(collectionId: string, entryId: string) {
      time.advance(60_000);
      await app.collections.add(collectionId, entryId);
    },
    /** Shares the Collection and lets every try and wait of it run. */
    async share(collectionId: string) {
      const answer = sharing.share(collectionId);
      await timers.advance(ALL_TRIES);
      return answer;
    },
  };
}

describe('sharing a Collection by a Collection Link', () => {
  it('sends the Edition, the name and the Entry ids as the Collection shows them, and answers the share text with the URL', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha', 'w_old', 'w_buzok']);

    const answer = await app.share(autumn);

    expect(answer).toEqual({
      ok: true,
      url: 'https://slovo.example/c/link000001',
      message: 'Колекція «Осінь» у SLOVO: https://slovo.example/c/link000001',
    });
    expect(app.api.made).toEqual([
      { edition: 'uk', name: 'Осінь', entryIds: ['w_buzok', 'w_old', 'w_kvasha'] },
    ]);
  });

  it('makes a new link with the current contents each time it is shared again', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    await app.share(autumn);
    await app.add(autumn, 'w_buzok');

    const again = await app.share(autumn);

    expect(again).toMatchObject({ ok: true, url: 'https://slovo.example/c/link000002' });
    expect(app.api.made.map(({ entryIds }) => entryIds)).toEqual([
      ['w_kvasha'],
      ['w_buzok', 'w_kvasha'],
    ]);
  });

  it('refuses an empty Collection, and a Collection that is gone, without asking the backend', async () => {
    const app = await device();
    const empty = await app.collection('Порожня');

    expect(await app.share(empty)).toEqual({ ok: false, reason: 'empty' });
    expect(await app.share('no-such-collection')).toEqual({ ok: false, reason: 'empty' });
    expect(app.api.calls).toBe(0);
  });

  it('refuses a Collection of more Entries than a link holds, without asking the backend', async () => {
    const app = await device();
    const big = await app.collection('Усе', manyIds);

    expect(await app.share(big)).toEqual({ ok: false, reason: 'too-many-entries' });
    expect(app.api.calls).toBe(0);
  });

  it('tries again by the one rule after a server error', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    app.api.failNext('server-error');

    expect(await app.share(autumn)).toMatchObject({ ok: true });
    expect(app.api.calls).toBe(2);
  });
});

describe('sharing a Collection that the backend does not link', () => {
  it('answers offline after every try, never queued, and makes no link', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    app.api.online = false;

    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'offline' });
    // The first try and three more (ADR 0037).
    expect(app.api.calls).toBe(4);
    expect(app.api.made).toEqual([]);
  });

  it('answers too many requests at once over the daily limit, without trying again', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    app.api.failNext('too-many-requests');

    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'too-many-requests' });
    expect(app.api.calls).toBe(1);
  });

  it('answers failed when the backend refuses the link or every try meets a server error', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    app.api.failNext('unexpected');
    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'failed' });

    for (let tries = 0; tries < 4; tries += 1) app.api.failNext('server-error');
    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('Collection Links switched off', () => {
  it('offers no sharing and asks the backend nothing while collectionLinks is off', async () => {
    const app = await device({ off: ['collectionLinks'] });
    const autumn = await app.collection('Осінь', ['w_kvasha']);

    expect(app.sharing.available()).toBe(false);
    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'switched-off' });
    expect(app.api.calls).toBe(0);
  });

  it('reads the switch each time, so a remote switch turns sharing off at once', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    expect(app.sharing.available()).toBe(true);

    app.switchedOff.add('collectionLinks');

    expect(app.sharing.available()).toBe(false);
    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'switched-off' });
  });

  it('answers switched off when the backend has Collection Links off for the Edition (404)', async () => {
    const app = await device();
    const autumn = await app.collection('Осінь', ['w_kvasha']);
    app.api.failNext('not-found');

    expect(await app.share(autumn)).toEqual({ ok: false, reason: 'switched-off' });
  });
});
