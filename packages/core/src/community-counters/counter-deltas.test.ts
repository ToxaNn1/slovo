import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
  type FeatureSwitch,
  userStateRecords,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, word } from '../test-support';

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  on = ['knowledge', 'communityCounters'],
}: {
  records?: Map<string, string>;
  on?: readonly FeatureSwitch[];
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => on.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: ['test'],
          correctionCategoryIds: 'all' as const,
          corrections: false,
          idioms: false,
          synonymRows: false,
          tips: false,
        },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock('2026-10-28T09:00:00.000Z').clock,
    random: { next: () => 0.25 },
  });
}

/** The unsent changes as plain entries, for comparing. */
const unsentOf = async (app: Composition) => [...(await app.communityCounters.unsent())];

/** Records where the reader marked the Word before the update, which counted nothing. */
async function markedBeforeTheUpdate(entryId: string, mark: 'known' | 'unknown') {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  await userState.write(
    userStateRecords.knowledge
      .record(entryId)
      .change({ mark, step: mark === 'known' ? null : 1, reviewDay: null, learned: false }),
  );
  return records;
}

/** Records where this device counted the Word marked, and sent it. */
async function countedAndSent(entryId: string, mark: 'known' | 'unknown') {
  const records = new Map<string, string>();
  const app = await run({ records });
  await app.knowledge.tap(entryId, mark);
  for (const key of records.keys()) if (key.startsWith('counters.unsent.')) records.delete(key);
  return records;
}

// Spec #886 stories 41, 44, 45; ADR 0060: the deltas a reader's Knowledge Marks give.
describe('Community Counter deltas from Knowledge Marks', () => {
  it('counts a new Known mark and a new Unknown mark one each', async () => {
    const app = await run();

    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('w_two', 'unknown');

    expect(await unsentOf(app)).toEqual([
      ['w_one', { known: 1, unknown: 0, saved: 0 }],
      ['w_two', { known: 0, unknown: 1, saved: 0 }],
    ]);
  });

  it('moves a sent Known mark to Unknown, and back', async () => {
    const records = await countedAndSent('w_one', 'known');
    const app = await run({ records });

    await app.knowledge.tap('w_one', 'unknown');
    expect(await unsentOf(app)).toEqual([['w_one', { known: -1, unknown: 1, saved: 0 }]]);

    await app.knowledge.tap('w_one', 'known');
    expect(await unsentOf(app)).toEqual([]);
  });

  it('takes a sent mark away when the reader removes it', async () => {
    const records = await countedAndSent('w_one', 'unknown');
    const app = await run({ records });

    await app.knowledge.tap('w_one', 'unknown');

    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: -1, saved: 0 }]]);
  });

  it('merges the changes not yet sent, so a mark set and removed again sends nothing', async () => {
    const app = await run();

    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('w_one', 'unknown');
    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 1, saved: 0 }]]);

    await app.knowledge.tap('w_one', 'unknown');
    expect(await unsentOf(app)).toEqual([]);
  });

  it('keeps the changes not yet sent for the next launch', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).knowledge.tap('w_one', 'known');

    expect(await unsentOf(await run({ records }))).toEqual([
      ['w_one', { known: 1, unknown: 0, saved: 0 }],
    ]);
  });

  it('never sends a mark from before the update, and counts a change of it as new', async () => {
    const app = await run({ records: await markedBeforeTheUpdate('w_one', 'known') });
    expect(await unsentOf(app)).toEqual([]);

    await app.knowledge.tap('w_one', 'unknown');
    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 1, saved: 0 }]]);
  });

  it('takes nothing away when the reader removes a mark from before the update', async () => {
    const app = await run({ records: await markedBeforeTheUpdate('w_one', 'unknown') });

    await app.knowledge.tap('w_one', 'unknown');

    expect(app.knowledge.state.shown.get('w_one')).toBeUndefined();
    expect(await unsentOf(app)).toEqual([]);
  });

  it('counts nothing with the communityCounters Feature Switch off', async () => {
    const app = await run({ on: ['knowledge'] });

    await app.knowledge.tap('w_one', 'known');

    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    expect(await unsentOf(app)).toEqual([]);
  });
});

/** Records where the reader added the Word to Favorites before the update, which counted nothing. */
async function savedBeforeTheUpdate(entryId: string) {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  await userState.write(
    userStateRecords.favorites.record(entryId).change('2026-10-01T09:00:00.000Z'),
  );
  return records;
}

/** Records where this device counted the Word added to Favorites, and sent it. */
async function savedAndSent(entryId: string) {
  const records = new Map<string, string>();
  const app = await run({ records });
  await app.favorites.add(entryId);
  for (const key of records.keys()) if (key.startsWith('counters.unsent.')) records.delete(key);
  return records;
}

// Spec #886 stories 41, 45; ADR 0060: the deltas a reader's Favorites give.
describe('Community Counter deltas from Favorites', () => {
  it('counts an Entry added to Favorites as saved one', async () => {
    const app = await run();

    await app.favorites.add('w_one');
    await app.favorites.toggle('w_two');

    expect(await unsentOf(app)).toEqual([
      ['w_one', { known: 0, unknown: 0, saved: 1 }],
      ['w_two', { known: 0, unknown: 0, saved: 1 }],
    ]);
  });

  it('takes a sent Favorite away when the reader removes it', async () => {
    const app = await run({ records: await savedAndSent('w_one') });

    await app.favorites.remove('w_one');

    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 0, saved: -1 }]]);
  });

  it('sends nothing for a Favorite added and removed again before sending', async () => {
    const app = await run();

    await app.favorites.add('w_one');
    await app.favorites.toggle('w_one');

    expect(app.favorites.has('w_one')).toBe(false);
    expect(await unsentOf(app)).toEqual([]);
  });

  it('counts nothing for adding an Entry already in Favorites', async () => {
    const app = await run({ records: await savedAndSent('w_one') });

    await app.favorites.add('w_one');

    expect(await unsentOf(app)).toEqual([]);
  });

  it('merges a Favorite and a mark of the same Entry', async () => {
    const app = await run();

    await app.knowledge.tap('w_one', 'known');
    await app.favorites.add('w_one');

    expect(await unsentOf(app)).toEqual([['w_one', { known: 1, unknown: 0, saved: 1 }]]);
  });

  it('keeps the counted mark when the Favorite is removed, and the Favorite when the mark is', async () => {
    const app = await run();
    await app.knowledge.tap('w_one', 'known');
    await app.favorites.add('w_one');

    await app.favorites.remove('w_one');
    await app.knowledge.tap('w_one', 'known');
    expect(await unsentOf(app)).toEqual([]);

    await app.favorites.add('w_one');
    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 0, saved: 1 }]]);
  });

  it('never sends a Favorite from before the update, and takes nothing away when it is removed', async () => {
    const app = await run({ records: await savedBeforeTheUpdate('w_one') });
    expect(app.favorites.has('w_one')).toBe(true);
    expect(await unsentOf(app)).toEqual([]);

    await app.favorites.remove('w_one');
    expect(await unsentOf(app)).toEqual([]);

    await app.favorites.add('w_one');
    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 0, saved: 1 }]]);
  });

  it('counts nothing with the communityCounters Feature Switch off', async () => {
    const app = await run({ on: ['knowledge'] });

    await app.favorites.add('w_one');

    expect(app.favorites.has('w_one')).toBe(true);
    expect(await unsentOf(app)).toEqual([]);
  });
});
