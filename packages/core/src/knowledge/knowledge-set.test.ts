import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type AnalyticsPort,
  type Clock,
  type Composition,
  type FeatureSwitch,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, testEdition, word, analyticsInto } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import type { KnowledgeRecord } from './knowledge-record';

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-10-19T09:00:00.000Z').clock,
  on = ['knowledge', 'confirmedEntries', 'communityCounters', 'xpLog'],
  analytics,
}: {
  records?: Map<string, string>;
  clock?: Clock;
  on?: readonly FeatureSwitch[];
  analytics?: AnalyticsPort;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
      userSettingDefaults: {
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
    ...(analytics === undefined ? {} : { analytics: analyticsInto(analytics) }),
  });
}

const DAY = 24 * 60 * 60_000;

/** Records where `w_one` has `record`, kept before this run. */
async function recordsWith(record: KnowledgeRecord): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  await userState.write(userStateRecords.knowledge.record('w_one').change(record));
  return records;
}

/** The records of Knowledge and confirmation, as kept. */
const marksOf = (records: Map<string, string>) =>
  [...records].filter(([key]) => key.startsWith('knowledge.') || key.startsWith('confirmed.'));

/** How many Review answers earned XP. */
const reviewXpOf = (records: Map<string, string>) =>
  [...records].filter(([key, value]) => key.startsWith('xp.') && value.includes('review-answer'))
    .length;

const unsentOf = async (app: Composition) => [...(await app.communityCounters.unsent())];

/** A Word marked Unknown at step 7 and due today, so Known on it confirms it. */
const dueAtStepSeven: KnowledgeRecord = {
  mark: 'unknown',
  step: 7,
  reviewDay: '2026-10-19',
  learned: false,
  markedAt: '2026-10-12T09:00:00.000Z',
};

// Spec #1578 «Core, Knowledge»: the marks a swipe and the card's menu set.
describe('setting, clearing and undoing a Knowledge Mark', () => {
  it('sets a mark on an Entry with no record, and keeps it for the next launch', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).knowledge.set('w_one', 'unknown');

    const next = await run({ records });
    expect(next.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(next.knowledge.state.due).toEqual([]);
  });

  it('changes nothing when the card shows the mark already', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.knowledge.set('w_one', 'known');
    const kept = marksOf(records);
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    await app.knowledge.set('w_one', 'known');

    expect(marksOf(records)).toEqual(kept);
    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    expect(told).toBe(0);
    expect(await unsentOf(app)).toEqual([['w_one', { known: 1, unknown: 0, saved: 0 }]]);
  });

  it('changes the mark to the other one', async () => {
    const app = await run();
    await app.knowledge.set('w_one', 'unknown');
    await app.knowledge.set('w_one', 'known');

    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    expect(await unsentOf(app)).toEqual([['w_one', { known: 1, unknown: 0, saved: 0 }]]);
  });

  it('clears the mark, deleting the record, and counts it back', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.knowledge.set('w_one', 'unknown');
    await app.knowledge.set('w_two', 'known');

    await app.knowledge.clear('w_one');

    expect(app.knowledge.state.shown.get('w_one')).toBeUndefined();
    expect(marksOf(records).map(([key]) => key)).toEqual(['knowledge.w_two']);
    expect(await unsentOf(app)).toEqual([['w_two', { known: 1, unknown: 0, saved: 0 }]]);
  });

  it('changes nothing on a clear of an Entry with no record', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    await app.knowledge.clear('w_one');

    expect(marksOf(records)).toEqual([]);
    expect(told).toBe(0);
  });

  it('undoes a set on an Entry with no record: no record again, nothing counted', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.knowledge.set('w_one', 'known');

    await app.knowledge.undo();

    expect(app.knowledge.state.shown.get('w_one')).toBeUndefined();
    expect(marksOf(records)).toEqual([]);
    expect(await unsentOf(app)).toEqual([]);
  });

  it('undoes a set to the exact record before, and counts the mark back', async () => {
    const app = await run();
    await app.knowledge.set('w_one', 'unknown');
    await app.knowledge.set('w_one', 'known');

    await app.knowledge.undo();

    expect(app.knowledge.state.shown.get('w_one')).toBe('unknown');
    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 1, saved: 0 }]]);
  });

  it('undoes a Review answer on a due Entry to its exact record, the confirmation too, and keeps the XP', async () => {
    const records = await recordsWith(dueAtStepSeven);
    const before = marksOf(records);
    const app = await run({ records });
    expect(app.knowledge.state.shown.get('w_one')).toBe('review');

    await app.knowledge.set('w_one', 'known');
    expect(app.knowledge.state.confirmed.total).toBe(1);
    expect(reviewXpOf(records)).toBe(1);

    await app.knowledge.undo();

    expect(marksOf(records)).toEqual(before);
    expect(app.knowledge.state.shown.get('w_one')).toBe('review');
    expect(app.knowledge.state.due).toEqual(['w_one']);
    expect(app.knowledge.state.confirmed.total).toBe(0);
    expect(reviewXpOf(records)).toBe(1);
    // The seeded mark counted nothing; counted back, it counts as the mark the Entry has.
    expect(await unsentOf(app)).toEqual([['w_one', { known: 0, unknown: 1, saved: 0 }]]);
  });

  it('undoes only the last set, once, and nothing after another change', async () => {
    const app = await run();
    await app.knowledge.set('w_one', 'known');
    await app.knowledge.set('w_two', 'unknown');
    await app.knowledge.undo();
    await app.knowledge.undo();

    expect(app.knowledge.state.shown.get('w_one')).toBe('known');
    expect(app.knowledge.state.shown.get('w_two')).toBeUndefined();

    await app.knowledge.set('w_two', 'unknown');
    await app.knowledge.clear('w_one');
    await app.knowledge.undo();
    expect(app.knowledge.state.shown.get('w_two')).toBe('unknown');
    expect(app.knowledge.state.shown.get('w_one')).toBeUndefined();
  });

  it('earns Review XP once per Entry on a local day, however often it is undone and set again', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const records = await recordsWith({ ...dueAtStepSeven, step: 1 });
    const app = await run({ records, clock: time.clock });

    await app.knowledge.set('w_one', 'unknown');
    await app.knowledge.undo();
    await app.knowledge.set('w_one', 'known');
    expect(reviewXpOf(records)).toBe(1);

    await app.knowledge.undo();
    time.advance(DAY);
    await app.resume();
    await app.knowledge.set('w_one', 'known');
    expect(reviewXpOf(records)).toBe(2);
  });

  it('earns Review XP once per Entry on a local day across a restart, under a cap that allows more', async () => {
    const records = await recordsWith({ ...dueAtStepSeven, step: 1 });
    const first = await run({ records });
    await first.knowledge.set('w_one', 'known');
    await first.knowledge.undo();
    expect(reviewXpOf(records)).toBe(1);

    // An hour later, so the new record's id differs from the first one's.
    const second = await run({ records, clock: fakeClock('2026-10-19T10:00:00.000Z').clock });
    expect(second.knowledge.state.shown.get('w_one')).toBe('review');
    await second.knowledge.set('w_one', 'known');

    expect(reviewXpOf(records)).toBe(1);
  });

  it('emits the Review answer event once per Entry on a local day across a restart', async () => {
    const records = await recordsWith({ ...dueAtStepSeven, step: 1 });
    const answered: unknown[] = [];
    const analytics: AnalyticsPort = {
      track: (event, properties) => {
        if (event === 'reviewAnswered') answered.push(properties);
      },
      stop: () => undefined,
    };
    const on: readonly FeatureSwitch[] = ['knowledge', 'xpLog', 'analytics'];
    const first = await run({ records, on, analytics });
    await first.knowledge.set('w_one', 'known');
    await first.knowledge.undo();
    expect(answered).toHaveLength(1);

    // An hour later, a second app on the same user state.
    const clock = fakeClock('2026-10-19T10:00:00.000Z').clock;
    const second = await run({ records, clock, on, analytics });
    expect(second.knowledge.state.shown.get('w_one')).toBe('review');
    await second.knowledge.set('w_one', 'unknown');

    expect(answered).toEqual([{ mark: 'known', entryKind: 'word', rarity: 3, categoryId: 'test' }]);
  });

  it('marks nothing with the knowledge switch off', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, on: [] });
    await app.knowledge.set('w_one', 'known');
    await app.knowledge.undo();

    expect(marksOf(records)).toEqual([]);
  });
});
