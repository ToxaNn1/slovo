import { PATCH_FORMAT, type Patch } from '@slovo/contracts/api';
import { describe, expect, it } from 'vitest';

import { CONTENT_UPDATE_EVERY, createContentUpdate } from '../index';
import { createFakeBackend, createMemoryContentStore } from '../testing';
import { fakeClock, randomOf, testSchedule } from '../test-support';

const MINUTE = 60 * 1000;

/** A Patch of the Edition `uk` from one content version to the next, changing the records given. */
function patchOf(since: number, records: Partial<Patch> = {}): Patch {
  return {
    editionId: 'uk',
    since,
    contentVersion: since + 1,
    patchFormat: PATCH_FORMAT,
    words: [],
    idioms: [],
    corrections: [],
    tips: [],
    synonymRows: [],
    curatedCollections: [],
    crosswordDays: [],
    mediaBase: 'https://media.slovo.test',
    recordings: [],
    illustrations: [],
    ...records,
  };
}

/** The app with its content store at a content version, a backend, and a schedule on a frozen clock. */
function app({ contentVersion = 4, readableFormats = [PATCH_FORMAT] } = {}) {
  const contentApi = createFakeBackend();
  const store = createMemoryContentStore({ contentVersion });
  const time = fakeClock();
  const { schedule, advance } = testSchedule(time);
  const contentUpdate = createContentUpdate({
    backend: contentApi.backend,
    edition: { id: 'uk' },
    store,
    random: randomOf(0.5),
    schedule,
    readableFormats,
  });
  return { contentApi, store, contentUpdate, advance };
}

describe('checking for a Patch', () => {
  it('asks for the Patch since the content version in the highest format it reads, and applies it', async () => {
    const { contentApi, store, contentUpdate } = app({ readableFormats: [1, PATCH_FORMAT] });
    const patch = patchOf(4);
    contentApi.content.publishPatch(patch);
    let told = 0;
    contentUpdate.subscribe(() => (told += 1));

    await contentUpdate.checkForUpdate();

    expect(contentApi.content.patchesAsked).toEqual([{ since: 4, patchFormat: PATCH_FORMAT }]);
    expect(store.applied).toEqual([patch]);
    expect(contentUpdate.contentVersion()).toBe(5);
    expect(told).toBe(1);
  });

  it('names the ETag of the Patch applied last, and a 304 changes nothing', async () => {
    const { contentApi, store, contentUpdate } = app();
    contentApi.content.publishPatch(patchOf(4));
    await contentUpdate.checkForUpdate();

    await contentUpdate.checkForUpdate();

    expect(contentApi.content.patchesAsked[1]).toEqual({
      since: 5,
      patchFormat: PATCH_FORMAT,
      ifNoneMatch: '"5"',
    });
    expect(store.applied).toHaveLength(1);
    expect(contentUpdate.contentVersion()).toBe(5);
  });

  it('changes nothing when the backend does not serve the Patch format asked for', async () => {
    const { contentApi, store, contentUpdate } = app();
    contentApi.content.publishPatch({ ...patchOf(4), patchFormat: PATCH_FORMAT + 1 });

    await contentUpdate.checkForUpdate();

    expect(store.applied).toEqual([]);
    expect(contentUpdate.contentVersion()).toBe(4);
  });

  it('keeps the content when the store rejects the Patch, and never rejects', async () => {
    const { contentApi, store, contentUpdate } = app();
    contentApi.content.publishPatch(patchOf(4));
    store.failApplying(true);
    let told = 0;
    contentUpdate.subscribe(() => (told += 1));

    await expect(contentUpdate.checkForUpdate()).resolves.toBeUndefined();

    expect(contentUpdate.contentVersion()).toBe(4);
    expect(told).toBe(0);
  });

  it('retries a request that gets no answer, and keeps the content when none comes', async () => {
    const { contentApi, contentUpdate, advance } = app();
    contentApi.content.publishPatch(patchOf(4));
    contentApi.online = false;

    const checked = contentUpdate.checkForUpdate();
    await advance(CONTENT_UPDATE_EVERY);
    await checked;

    expect(contentApi.content.patchesAsked.length).toBeGreaterThan(1);
    expect(contentUpdate.contentVersion()).toBe(4);
  });

  it('joins a check under way', async () => {
    const { contentApi, store, contentUpdate } = app();
    contentApi.content.publishPatch(patchOf(4));
    const release = contentApi.hold();

    const first = contentUpdate.checkForUpdate();
    const second = contentUpdate.checkForUpdate();
    release();
    await Promise.all([first, second]);

    expect(second).toBe(first);
    expect(contentApi.content.patchesAsked).toHaveLength(1);
    expect(store.applied).toHaveLength(1);
  });
});

describe('following the foreground', () => {
  it('checks every 15 minutes of the clock, not before, until stopped', async () => {
    const { contentApi, contentUpdate, advance } = app();

    const stop = contentUpdate.followForeground();
    await advance(CONTENT_UPDATE_EVERY - MINUTE);
    expect(contentApi.content.patchesAsked).toHaveLength(0);
    await advance(MINUTE);
    expect(contentApi.content.patchesAsked).toHaveLength(1);
    await advance(CONTENT_UPDATE_EVERY);
    expect(contentApi.content.patchesAsked).toHaveLength(2);

    stop();
    await advance(2 * CONTENT_UPDATE_EVERY);
    expect(contentApi.content.patchesAsked).toHaveLength(2);
  });

  it('applies a Patch published while the app is in the foreground', async () => {
    const { contentApi, contentUpdate, advance } = app();
    contentUpdate.followForeground();

    contentApi.content.publishPatch(patchOf(4));
    await advance(CONTENT_UPDATE_EVERY);

    expect(contentUpdate.contentVersion()).toBe(5);
  });
});
