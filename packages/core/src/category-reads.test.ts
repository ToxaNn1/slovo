import { describe, expect, it } from 'vitest';

import {
  categoryPlace,
  openComposition,
  type Composition,
  type UserStateChanges,
  type UserStatePort,
} from './index';
import { createMemoryContentPort } from './testing';
import { correction, fakeClock, testEdition, word } from './test-support';
import { createMemoryUserStatePort, openUserState } from './user-state/user-state';

/** Two Categories of Words and two of Corrections, sharing the id `speech`, each with a Retired Entry. */
const content = createMemoryContentPort({
  words: [
    word('w_one', { categoryId: 'speech' }),
    word('w_other', { categoryId: 'nature' }),
    word('w_old', { categoryId: 'speech', retired: true }),
    word('w_two', { categoryId: 'speech', rarity: 5 }),
  ],
  corrections: [
    correction('c_one', { categoryId: 'speech' }),
    correction('c_old', { categoryId: 'speech', retired: true }),
    correction('c_two', { categoryId: 'speech' }),
    correction('c_other', { categoryId: 'everyday' }),
  ],
});

/** The Core composition of one app run over the records, with every write it makes kept. */
async function run() {
  const records = new Map<string, string>();
  const memory = createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  const port: UserStatePort = {
    ...memory,
    write(changes) {
      writes.push(changes);
      return memory.write(changes);
    },
  };
  const app: Composition = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: (feature) => feature === 'knowledge' }),
    userState: await openUserState({ port }),
    clock: fakeClock().clock,
    random: { next: () => 0.25 },
  });
  return { app, records, writes };
}

const idsOf = (entries: readonly { readonly id: string }[]) => entries.map(({ id }) => id);

describe('the live Entries of a Category', () => {
  it('gives the Words of a Category of Words in pack order, Retired ones left out', async () => {
    const { app } = await run();
    const words = await app.categoryEntries('word', 'speech');
    expect(idsOf(words)).toEqual(['w_one', 'w_two']);
    expect(words.every(({ kind }) => kind === 'word')).toBe(true);
  });

  it('gives the Corrections of a Category of Corrections in pack order, Retired ones left out', async () => {
    const { app } = await run();
    const corrections = await app.categoryEntries('correction', 'speech');
    expect(idsOf(corrections)).toEqual(['c_one', 'c_two']);
    expect(corrections.every(({ kind }) => kind === 'correction')).toBe(true);
  });

  it('still gives them while the Category is out of the Mix', async () => {
    const { app } = await run();
    expect(await app.mix.setCategory('nature', false)).toBe(true);
    expect(idsOf(await app.categoryEntries('word', 'nature'))).toEqual(['w_other']);
  });

  it('gives none for a Category the list does not have', async () => {
    const { app } = await run();
    expect(await app.categoryEntries('correction', 'nature')).toEqual([]);
  });

  it('never makes an Entry Seen and writes nothing', async () => {
    const { app, records, writes } = await run();
    const before = writes.length;
    const seenToday = app.progress.state.seenToday;
    const words = await app.categoryEntries('word', 'speech');
    await app.categoryEntries('correction', 'speech');
    app.knowledge.knownAmong(idsOf(words));
    expect(writes).toHaveLength(before);
    expect(records.has('feed.seen.w_one')).toBe(false);
    expect(records.has('feed.seen.c_one')).toBe(false);
    expect(app.progress.state.seenToday).toBe(seenToday);
  });
});

describe('the Known counts of a set of Entries', () => {
  it('counts the Entries of a Category marked Known', async () => {
    const { app } = await run();
    await app.knowledge.set('w_one', 'known');
    await app.knowledge.set('w_two', 'unknown');
    await app.knowledge.set('w_other', 'known');
    await app.knowledge.set('c_one', 'known');
    expect(app.knowledge.knownAmong(idsOf(await app.categoryEntries('word', 'speech')))).toBe(1);
    expect(app.knowledge.knownAmong(idsOf(await app.categoryEntries('correction', 'speech')))).toBe(
      1,
    );
  });

  it('counts any set of Entries, such as a Collection, each id once', async () => {
    const { app } = await run();
    await app.knowledge.set('w_one', 'known');
    await app.knowledge.set('c_two', 'known');
    expect(app.knowledge.knownAmong(['w_one', 'c_two', 'w_one', 'w_other', 'w_missing'])).toBe(2);
  });

  it('counts none with the knowledge Feature Switch off', async () => {
    const { app: before, records } = await run();
    await before.knowledge.set('w_one', 'known');
    expect(before.knowledge.knownAmong(['w_one'])).toBe(1);
    await before.close();
    const app = await openComposition({
      content,
      edition: testEdition({ isFeatureEnabled: () => false }),
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: fakeClock().clock,
      random: { next: () => 0.25 },
    });
    expect(app.knowledge.knownAmong(['w_one'])).toBe(0);
  });
});

describe('a Category in the Mix', () => {
  it('takes a Category out and puts it back by list and id, and answers its place', async () => {
    const { app } = await run();
    const place = () => categoryPlace(app.mix.state, 'correction', 'speech');
    expect(place()).toBe('in');
    expect(await app.mix.setCategory('speech', false, 'correction')).toBe(true);
    expect(place()).toBe('out');
    expect(categoryPlace(app.mix.state, 'word', 'speech')).toBe('in');
    expect(await app.mix.setCategory('speech', true, 'correction')).toBe(true);
    expect(place()).toBe('in');
  });

  it('keeps the last Category of each list in the Mix', async () => {
    const { app } = await run();
    expect(await app.mix.setCategory('speech', false)).toBe(true);
    expect(categoryPlace(app.mix.state, 'word', 'nature')).toBe('last');
    expect(await app.mix.setCategory('nature', false)).toBe(false);
    expect(categoryPlace(app.mix.state, 'word', 'nature')).toBe('last');
    expect(await app.mix.setCategory('everyday', false, 'correction')).toBe(true);
    expect(await app.mix.setCategory('speech', false, 'correction')).toBe(false);
    expect(categoryPlace(app.mix.state, 'correction', 'speech')).toBe('last');
  });

  it('answers nothing for a Category the list does not have, and refuses to change it', async () => {
    const { app } = await run();
    expect(categoryPlace(app.mix.state, 'correction', 'nature')).toBeUndefined();
    expect(await app.mix.setCategory('nature', false, 'correction')).toBe(false);
    expect(await app.mix.setCategory('nature', true, 'correction')).toBe(false);
  });
});
