import { describe, expect, it } from 'vitest';

import {
  openComposition,
  type Composition,
  type FeatureSwitch,
  type FeedCard,
  type XpRecord,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';

// Spec #1358 story 70 and its Feed Notices, ticket #1383: the save-progress
// Feed Notice on Streak day 3 and on the day of the first new Level, at most
// twice in total, only to a reader with no Account.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

const ALL_ON: readonly FeatureSwitch[] = ['xpLog', 'levels', 'profile', 'account'];

/** One XP record of `amount` on the local day `date`, at 08:00 in Kyiv. */
const xp = (date: string, amount: number): XpRecord => ({
  kind: 'xp',
  date,
  at: new Date(`${date}T08:00:00+03:00`).toISOString(),
  source: 'game-round',
  amount,
});

/** The records of a reader whose XP log holds `xps`. */
async function readerWith(...xps: readonly XpRecord[]): Promise<Map<string, string>> {
  const records = new Map<string, string>();
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  for (const [index, record] of xps.entries()) {
    await userState.write(userStateRecords.xpLog.record(`seeded-${String(index)}`).change(record));
  }
  return records;
}

/** The Core composition of one app run on the local day `on`, over the records. */
async function run({
  records,
  on,
  off = [],
  signedIn = false,
}: {
  records: Map<string, string>;
  on: string;
  off?: readonly FeatureSwitch[];
  signedIn?: boolean;
}): Promise<Composition> {
  return openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => ALL_ON.includes(feature) && !off.includes(feature),
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: fakeClock(`${on}T09:00:00+03:00`).clock,
    random: seededRandom(7),
    signedIn: () => signedIn,
  });
}

/** The save-progress Feed Notices among the Feed's first cards. */
async function offersIn(app: Composition): Promise<readonly FeedCard[]> {
  while (app.feed.cards.length < 4) {
    if ((await app.feed.next()) === undefined) break;
  }
  return app.feed.cards.filter((card) => card.kind === 'notice' && card.notice === 'saveProgress');
}

/** The XP of a three-day Streak ending on 2026-10-14. */
const threeDays = [xp('2026-10-12', 5), xp('2026-10-13', 5), xp('2026-10-14', 5)];

describe('the save-progress Feed Notice', () => {
  it('comes on the day the Streak reaches 3', async () => {
    const records = await readerWith(...threeDays);

    expect(await offersIn(await run({ records, on: '2026-10-14' }))).toEqual([
      expect.objectContaining({ kind: 'notice', notice: 'saveProgress' }),
    ]);
  });

  it('comes not on Streak day 2, nor on day 3 before today is an Active Day', async () => {
    const two = await readerWith(xp('2026-10-13', 5), xp('2026-10-14', 5));
    expect(await offersIn(await run({ records: two, on: '2026-10-14' }))).toEqual([]);

    const notYet = await readerWith(xp('2026-10-12', 5), xp('2026-10-13', 5), xp('2026-10-14', 4));
    expect(await offersIn(await run({ records: notYet, on: '2026-10-14' }))).toEqual([]);
  });

  it('comes on the day of the first new Level', async () => {
    const records = await readerWith(xp('2026-10-01', 40), xp('2026-10-14', 10));

    expect(await offersIn(await run({ records, on: '2026-10-14' }))).toHaveLength(1);
    expect(await offersIn(await run({ records, on: '2026-10-15' }))).toEqual([]);
  });

  it('comes at most twice in total, on two days', async () => {
    const records = await readerWith(
      ...threeDays,
      // The Streak breaks, and grows to 3 again, twice.
      xp('2026-10-20', 5),
      xp('2026-10-21', 5),
      xp('2026-10-22', 5),
      xp('2026-10-28', 5),
      xp('2026-10-29', 5),
      xp('2026-10-30', 5),
    );
    const shown = [];
    for (const on of ['2026-10-14', '2026-10-14', '2026-10-22', '2026-10-30']) {
      shown.push((await offersIn(await run({ records, on }))).length);
    }
    // A second run on the same day shows it again; a third day does not.
    expect(shown).toEqual([1, 1, 1, 0]);
  });

  it('never comes to a reader with an Account, or while the Profile or the Account is off', async () => {
    const records = await readerWith(...threeDays);
    const on = '2026-10-14';

    expect(await offersIn(await run({ records, on, signedIn: true }))).toEqual([]);
    expect(await offersIn(await run({ records, on, off: ['profile'] }))).toEqual([]);
    expect(await offersIn(await run({ records, on, off: ['account'] }))).toEqual([]);
  });
});
