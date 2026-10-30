import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openCounterReads,
  openCounterSending,
  openUserState,
  type CounterReads,
  type FeatureSwitch,
} from '../index';
import { createFakeBackend, createMemoryContentPort, type FakeBackend } from '../testing';
import { fakeClock, randomOf, testEdition, testSchedule, word } from '../test-support';
import type { UserState } from '../user-state/user-state';

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two'), word('w_three')] });

/** The Edition with the Feature Switches in `on` on. */
const editionWith = (on: readonly FeatureSwitch[]) =>
  testEdition({
    isFeatureEnabled: (feature) => on.includes(feature),
    userSettingDefaults: {
      mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
    },
  });

/** One app run: the counter reads and the Core composition over the same user state, at a time the test moves. */
async function run({
  on = ['knowledge', 'communityCounters'],
  api = createFakeBackend(),
  userState,
}: {
  on?: readonly FeatureSwitch[];
  api?: FakeBackend;
  userState?: UserState;
} = {}) {
  const time = fakeClock('2026-10-28T09:00:00.000Z');
  const state = userState ?? (await openUserState({ port: createMemoryUserStatePort() }));
  const edition = editionWith(on);
  const reads: CounterReads = openCounterReads({
    edition,
    backend: api.backend,
    userState: state,
    clock: time.clock,
  });
  const app = await openComposition({
    content,
    edition,
    userState: state,
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { api, reads, app, time, userState: state };
}

/** The lines as plain entries, for comparing. */
const linesOf = async (reads: CounterReads, entryIds: readonly string[]) => [
  ...(await reads.lines(entryIds)),
];

const HOUR = 60 * 60 * 1000;

// Spec #886 story 38 and Implementation Decisions; ADR 0060: the device reads counters.
describe('Reading Community Counters', () => {
  it('reads the Entries near the current card in one request, as lines of known, total and saved', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads } = await run({ api });

    expect(await linesOf(reads, ['w_one', 'w_two'])).toEqual([
      ['w_one', { known: 3, total: 5, saved: 1 }],
      ['w_two', { known: 0, total: 0, saved: 0 }],
    ]);
    expect(api.counters.asked).toEqual([['w_one', 'w_two']]);
  });

  it('keeps the numbers for 24 hours and asks only for the Entries it has none of', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads, time } = await run({ api });
    await reads.lines(['w_one']);
    api.counters.count('w_one', { known: 9, unknown: 9, saved: 9 });

    time.advance(24 * HOUR - 1);
    expect(await linesOf(reads, ['w_one', 'w_two'])).toEqual([
      ['w_one', { known: 3, total: 5, saved: 1 }],
      ['w_two', { known: 0, total: 0, saved: 0 }],
    ]);
    expect(await linesOf(reads, ['w_one', 'w_two'])).toHaveLength(2);
    expect(api.counters.asked).toEqual([['w_one'], ['w_two']]);
  });

  it('asks again after 24 hours', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads, time } = await run({ api });
    await reads.lines(['w_one']);
    api.counters.count('w_one', { known: 4, unknown: 2, saved: 1 });

    time.advance(24 * HOUR);
    expect(await linesOf(reads, ['w_one'])).toEqual([['w_one', { known: 4, total: 6, saved: 1 }]]);
    expect(api.counters.asked).toEqual([['w_one'], ['w_one']]);
  });

  it('keeps the numbers on the device for the next app run', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const first = await run({ api });
    await first.reads.lines(['w_one']);

    const next = await run({ api, userState: first.userState });
    api.failNext('offline');
    expect(await linesOf(next.reads, ['w_one'])).toEqual([
      ['w_one', { known: 3, total: 5, saved: 1 }],
    ]);
    expect(api.counters.asked).toEqual([['w_one']]);
  });

  it('applies the reader’s own unsent change on top, so their mark counts at once', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    api.counters.count('w_two', { known: 1, unknown: 0, saved: 0 });
    const { reads, app } = await run({ api });
    await reads.lines(['w_one', 'w_two']);

    await app.knowledge.tap('w_one', 'known');
    await app.knowledge.tap('w_two', 'known');
    await app.knowledge.tap('w_two', 'unknown');
    await app.knowledge.tap('w_three', 'unknown');

    expect(await linesOf(reads, ['w_one', 'w_two', 'w_three'])).toEqual([
      ['w_one', { known: 4, total: 6, saved: 1 }],
      ['w_two', { known: 1, total: 2, saved: 0 }],
      ['w_three', { known: 0, total: 1, saved: 0 }],
    ]);
  });

  it('keeps the reader’s own change in the line once it is sent, until the numbers are read again', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads, app, time, userState } = await run({ api });
    await reads.lines(['w_one']);
    await app.knowledge.tap('w_one', 'known');
    const timers = testSchedule(time);
    const sending = openCounterSending({
      edition: editionWith(['knowledge', 'communityCounters']),
      backend: api.backend,
      userState,
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });

    sending.foreground();
    await timers.advance(10_000);
    sending.background();

    expect(api.counters.sent).toEqual([[{ entryId: 'w_one', known: 1, unknown: 0, saved: 0 }]]);
    expect(await linesOf(reads, ['w_one'])).toEqual([['w_one', { known: 4, total: 6, saved: 1 }]]);
  });

  it('never shows a count below zero when the own change takes away what the server has not counted yet', async () => {
    const records = new Map<string, string>();
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });
    const { reads, app } = await run({ userState });
    await reads.lines(['w_one']);
    // A mark set and sent after the numbers were read, then removed.
    await app.knowledge.tap('w_one', 'known');
    for (const key of records.keys()) if (key.startsWith('counters.unsent.')) records.delete(key);
    await app.knowledge.tap('w_one', 'known');

    expect(await linesOf(reads, ['w_one'])).toEqual([['w_one', { known: 0, total: 0, saved: 0 }]]);
  });

  it('gives no line offline for an Entry with no numbers from the last 24 hours, rather than zeros', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads, time } = await run({ api });
    await reads.lines(['w_one']);

    time.advance(24 * HOUR);
    api.failNext('offline');
    expect(await linesOf(reads, ['w_one', 'w_two'])).toEqual([]);
  });

  it('gives the lines it keeps when the request for the others fails', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads } = await run({ api });
    await reads.lines(['w_one']);

    api.failNext('server-error');
    expect(await linesOf(reads, ['w_one', 'w_two'])).toEqual([
      ['w_one', { known: 3, total: 5, saved: 1 }],
    ]);
  });

  it('gives no line and asks nothing with the communityCounters Feature Switch off', async () => {
    const api = createFakeBackend();
    api.counters.count('w_one', { known: 3, unknown: 2, saved: 1 });
    const { reads } = await run({ api, on: ['knowledge'] });

    expect(await linesOf(reads, ['w_one'])).toEqual([]);
    expect(api.counters.asked).toEqual([]);
  });

  it('asks nothing for no Entries', async () => {
    const api = createFakeBackend();
    const { reads } = await run({ api });

    expect(await linesOf(reads, [])).toEqual([]);
    expect(api.counters.asked).toEqual([]);
  });
});
