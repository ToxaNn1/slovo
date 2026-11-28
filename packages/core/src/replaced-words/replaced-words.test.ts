import type { Word } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { createMemorySessionStore, openAccount, openComposition, openSync } from '../index';
import type { UserStateChanges } from '../ports';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  createMemoryContentPort,
} from '../testing';
import { signInByCode, type FakeBackend } from '../fakes/fake-backend';
import { fakeClock, randomOf, testEdition, testSchedule, word } from '../test-support';
import { trackChanges } from '../user-state/tracked-user-state';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const {
  favorites,
  collections,
  collectionEntries,
  history,
  wordOfTheDayArchive,
  knowledge,
  confirmed,
  reviewAnswered,
  seen,
  hiddenEntries,
  cycle,
} = userStateRecords;

/** The Retired copy and the Word that replaces it. */
const OLD = 'w_old';
const NEW = 'w_new';

const EARLIER = '2026-10-01T09:00:00.000Z';
const LATER = '2026-10-05T09:00:00.000Z';

/** A Knowledge Mark due for Review before the clock's day, set at the instant. */
const dueMark = (markedAt: string) =>
  ({ mark: 'unknown', step: 1, reviewDay: '2026-10-08', learned: false, markedAt }) as const;
/** A Knowledge Mark in Review a week on, set at the instant. */
const knownMark = (markedAt: string) =>
  ({ mark: 'known', step: 7, reviewDay: '2026-10-20', learned: false, markedAt }) as const;

/** The pack once the Patch has Retired the copy and named the Word that replaces it. */
const patched = (words: readonly Word[] = []) =>
  createMemoryContentPort({
    words: [word(NEW), word(OLD, { retired: true, replacedBy: NEW }), word('w_other'), ...words],
  });

/** The records the changes leave, as the device kept them. */
const left = (...changes: UserStateChanges[]): [string, string][] =>
  changes.flatMap((change) =>
    [...change].flatMap(([key, value]): [string, string][] =>
      value === undefined ? [] : [[key, value]],
    ),
  );

/** Every record the reader keeps of the Entry: the Retired copy's records of each kind. */
const kept = (entryId: string, at = EARLIER) =>
  left(
    favorites.record(entryId).change(at),
    collections.record('c_1').change({ name: 'Mine', createdAt: EARLIER }),
    collectionEntries.record(`c_1.${entryId}`).change(at),
    history.record(entryId).change({ seenAt: at, wordOfTheDay: true }),
    wordOfTheDayArchive.record('2026-10-01').change(entryId),
    knowledge.record(entryId).change(dueMark(at)),
    confirmed.record(entryId).change(at),
    reviewAnswered.record(entryId).change('2026-10-02'),
    cycle.change({ id: 2, seed: 7 }),
    seen.record(entryId).change(2),
    hiddenEntries.record(entryId).change(at),
  );

/** The text a record keeps for the value. */
const textOf = (change: UserStateChanges): string | undefined => [...change.values()][0];

/** The app as it opens over the device's records and the pack: the composition every screen reads. */
async function open(records: Map<string, string>, pack = patched()) {
  const time = fakeClock('2026-10-11T09:00:00+03:00');
  const app = await openComposition({
    content: pack,
    edition: testEdition({
      isFeatureEnabled: () => true,
      userSettingDefaults: { mix: { categoryIds: ['test'] } },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
    random: { next: () => 0.25 },
  });
  return { app, time };
}

/** The records of the Entry, by key. */
const recordsOf = (records: ReadonlyMap<string, string>, entryId: string) =>
  [...records].filter(
    ([key, value]) => key.endsWith(`.${entryId}`) || value === JSON.stringify(entryId),
  );

describe('a Retired Word that names the Word replacing it', () => {
  it('moves every record the reader keeps of it to the replacing Word', async () => {
    const records = new Map(kept(OLD));

    const { app } = await open(records);

    expect(recordsOf(records, OLD)).toEqual([]);
    expect(new Map(recordsOf(records, NEW))).toEqual(new Map(recordsOf(new Map(kept(NEW)), NEW)));
    expect(app.favorites.list.map(({ entryId }) => entryId)).toEqual([NEW]);
    expect(app.collections.entries('c_1').map(({ entryId }) => entryId)).toEqual([NEW]);
    expect(app.history.list.map(({ entryId }) => entryId)).toEqual([NEW]);
    expect(app.knowledge.state.shown.get(NEW)).toBe('review');
    expect(app.knowledge.state.shown.has(OLD)).toBe(false);
    expect(app.hiddenEntries.has(NEW)).toBe(true);
  });

  it('keeps the earlier add of two Favorites and Collection entries, and the later answer of two Knowledge Marks', async () => {
    const records = new Map([
      ...left(
        favorites.record(NEW).change(LATER),
        collectionEntries.record(`c_1.${NEW}`).change(EARLIER),
        knowledge.record(NEW).change(dueMark(EARLIER)),
        history.record(NEW).change({ seenAt: EARLIER, wordOfTheDay: false }),
        confirmed.record(NEW).change(LATER),
        reviewAnswered.record(NEW).change('2026-10-01'),
        seen.record(NEW).change(1),
        hiddenEntries.record(NEW).change(LATER),
      ),
      ...left(
        favorites.record(OLD).change(EARLIER),
        collectionEntries.record(`c_1.${OLD}`).change(LATER),
        knowledge.record(OLD).change(knownMark(LATER)),
        history.record(OLD).change({ seenAt: LATER, wordOfTheDay: true }),
        confirmed.record(OLD).change(EARLIER),
        reviewAnswered.record(OLD).change('2026-10-02'),
        seen.record(OLD).change(2),
        hiddenEntries.record(OLD).change(EARLIER),
      ),
    ]);

    await open(records);

    expect(recordsOf(records, OLD)).toEqual([]);
    expect(new Map(recordsOf(records, NEW))).toEqual(
      new Map(
        left(
          favorites.record(NEW).change(EARLIER),
          collectionEntries.record(`c_1.${NEW}`).change(EARLIER),
          knowledge.record(NEW).change(knownMark(LATER)),
          history.record(NEW).change({ seenAt: LATER, wordOfTheDay: true }),
          confirmed.record(NEW).change(EARLIER),
          reviewAnswered.record(NEW).change('2026-10-02'),
          seen.record(NEW).change(2),
          hiddenEntries.record(NEW).change(EARLIER),
        ),
      ),
    );
  });

  it('keeps the replacing Word’s own Knowledge Mark when it was answered later, or neither tells when', async () => {
    const answeredLater = new Map(
      left(
        knowledge.record(OLD).change(knownMark(EARLIER)),
        knowledge.record(NEW).change(dueMark(LATER)),
      ),
    );
    const { markedAt: _markedAt, ...untimed } = knownMark(EARLIER);
    const neitherTells = new Map(
      left(knowledge.record(OLD).change(untimed), knowledge.record(NEW).change(dueMark(EARLIER))),
    );

    await open(answeredLater);
    await open(neitherTells);

    expect(answeredLater.get(knowledge.record(NEW).key)).toBe(
      textOf(knowledge.record(NEW).change(dueMark(LATER))),
    );
    expect(neitherTells.get(knowledge.record(NEW).key)).toBe(
      textOf(knowledge.record(NEW).change(dueMark(EARLIER))),
    );
    expect(answeredLater.has(knowledge.record(OLD).key)).toBe(false);
    expect(neitherTells.has(knowledge.record(OLD).key)).toBe(false);
  });

  it('changes nothing on a second run', async () => {
    const records = new Map(kept(OLD));
    await open(records);
    const moved = new Map(records);

    await open(records);

    expect(records).toEqual(moved);
  });

  it('follows a replacing Word that was Retired and replaced in turn', async () => {
    const records = new Map(left(favorites.record('w_oldest').change(EARLIER)));

    await open(records, patched([word('w_oldest', { retired: true, replacedBy: OLD })]));

    expect([...records.keys()].filter((key) => key.startsWith(favorites.prefix))).toEqual([
      favorites.record(NEW).key,
    ]);
  });

  it('leaves the records of a Retired Word that names none, and of one whose replacing Word the pack lacks', async () => {
    const records = new Map(
      left(favorites.record('w_gone').change(EARLIER), favorites.record('w_lost').change(EARLIER)),
    );

    await open(
      records,
      patched([
        word('w_gone', { retired: true }),
        word('w_lost', { retired: true, replacedBy: 'w_absent' }),
      ]),
    );

    expect([...records.keys()].filter((key) => key.startsWith(favorites.prefix))).toEqual([
      favorites.record('w_gone').key,
      favorites.record('w_lost').key,
    ]);
  });
});

/** One device of the Account `anna@mail.com` on the backend, over the records an earlier run left. */
async function device(
  server: FakeBackend,
  time: ReturnType<typeof fakeClock>,
  timers: ReturnType<typeof testSchedule>,
  records: Map<string, string>,
) {
  const userState = trackChanges({
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: time.clock,
  });
  await userState.write(userStateRecords.installed.change(true));
  const edition = testEdition({
    isFeatureEnabled: () => true,
    userSettingDefaults: { mix: { categoryIds: ['test'] } },
  });
  const account = await openAccount({
    backend: server.backend,
    edition: { id: 'uk', isFeatureEnabled: () => false },
    googleSheet: createFakeGoogleSignInSheet(),
    appleSheet: createFakeAppleSignInSheet(),
    userState,
    sessions: createMemorySessionStore(await signInByCode(server)),
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
  return {
    records,
    /** Keeps the changes, as the reader's own action does. */
    keep: (changes: UserStateChanges) => userState.write(changes),
    /** Opens the app over the pack, as at launch, after a Patch and after a sync that wrote. */
    async open(pack = patched()) {
      const app = await openComposition({
        content: pack,
        edition,
        userState,
        clock: time.clock,
        random: { next: () => 0.25 },
      });
      await app.close();
    },
    async sync() {
      sync.foreground();
      await timers.advance(0);
      sync.background();
    },
  };
}

/** The synced records the device keeps of either Word, by key. */
const ofEitherWord = (records: ReadonlyMap<string, string>) =>
  new Map(
    [...records]
      .filter(([key]) => !key.startsWith('sync.') && !key.startsWith('feed.'))
      .filter(([key]) => key.endsWith(`.${OLD}`) || key.endsWith(`.${NEW}`)),
  );

describe('two devices of one Account', () => {
  it('converge through Sync on the replacing Word, whichever applied the Patch first', async () => {
    const time = fakeClock('2026-10-11T09:00:00+03:00');
    const timers = testSchedule(time);
    const server = createFakeBackend({ clock: time.clock });
    const before = createMemoryContentPort({ words: [word(NEW), word(OLD), word('w_other')] });
    const phone = await device(
      server,
      time,
      timers,
      new Map(
        left(favorites.record(OLD).change(EARLIER), knowledge.record(OLD).change(dueMark(EARLIER))),
      ),
    );
    const tablet = await device(
      server,
      time,
      timers,
      new Map(
        left(favorites.record(NEW).change(LATER), knowledge.record(NEW).change(knownMark(LATER))),
      ),
    );
    // Both hold the pack of before the Patch and the same records.
    await phone.open(before);
    await phone.sync();
    await tablet.open(before);
    await tablet.sync();
    await phone.sync();

    // The phone applies the Patch and syncs; the tablet, still on the older
    // pack, adds the Retired copy to a Collection and syncs after it.
    time.advance(60_000);
    await phone.open();
    await phone.sync();
    time.advance(60_000);
    await tablet.sync();
    await tablet.keep(collectionEntries.record(`c_1.${OLD}`).change(LATER));
    time.advance(60_000);
    await tablet.open();
    await tablet.sync();
    time.advance(60_000);
    await phone.sync();
    await phone.open();
    await phone.sync();
    await tablet.sync();
    await tablet.open();

    expect(ofEitherWord(phone.records)).toEqual(ofEitherWord(tablet.records));
    expect(ofEitherWord(phone.records)).toEqual(
      new Map(
        left(
          favorites.record(NEW).change(EARLIER),
          collectionEntries.record(`c_1.${NEW}`).change(LATER),
          knowledge.record(NEW).change(knownMark(LATER)),
        ),
      ),
    );
  });
});
