import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  entryIdOf,
  HISTORY_CAP,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Clock,
  type Composition,
  type UserStateChanges,
  type UserStatePort,
} from '../index';

/** The Edition's one Category, the test Words' own, and its default Mix of every Category. */
const testCategories = {
  id: 'test',
  languageTraits: { distractorRule: 'same-part-of-speech' as const },
  categories: [{ id: 'test', displayName: 'Test' }],
  userSettingDefaults: { mix: { categoryIds: ['test'], corrections: true }, notificationTimes: [] },
};

function word(id: string, retired = false): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'test',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired,
  };
}

function correction(id: string): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: `not ${id.slice(2)}`,
    correctionType: 'calque',
    standardEquivalents: [id.slice(2)],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

/** A small pack: three live Words, a Retired Word and a Correction. */
const words = [word('w_one'), word('w_two'), word('w_three'), word('w_old', true)];
const corrections = [correction('c_one')];

/** A clock the test moves by hand. */
function fakeClock(start = '2026-10-11T09:00:00+03:00') {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance(ms: number) {
      now += ms;
    },
  };
}

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  clock = fakeClock().clock,
  pack = words,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  clock?: Clock;
  pack?: readonly Word[];
} = {}): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort({ words: pack, corrections }),
    edition: { ...testCategories, isFeatureEnabled: (feature) => feature === 'corrections' },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
}

/** Shows the card at `position` for `ms` and takes it off screen, as the UI reports it. */
async function look(
  app: Composition,
  time: ReturnType<typeof fakeClock>,
  position: number,
  ms = SEEN_DWELL_MS,
) {
  await app.feed.show(position);
  time.advance(ms);
  await app.feed.show(undefined);
}

/** Reads the last card for the dwell time; returns the card the Feed got ready after it. */
async function readLastCard(app: Composition, time: ReturnType<typeof fakeClock>) {
  const position = app.feed.cards.length - 1;
  await look(app, time, position);
  return app.feed.cards[position + 1];
}

/** The Entry the card at `position` shows. */
function idAt(app: Composition, position: number): string {
  const id = entryIdOf(app.feed.cards[position]);
  if (id === undefined) throw new Error(`No Entry card at ${String(position)}`);
  return id;
}

/** The ids in History, newest first. */
const idsOf = ({ history }: Composition) => history.list.map((entry) => entry.entryId);

/** The ids that have a record under the prefix, sorted. */
const idsUnder = (records: Map<string, string>, prefix: string) =>
  [...records.keys()]
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort();

describe('History', () => {
  it('starts empty, also over Seen marks kept before it existed', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    records.set('feed.seen.w_two', JSON.stringify(true));

    const app = await run({ records });

    expect(first.history.list).toEqual([]);
    expect(app.history.list).toEqual([]);
  });

  it('records an Entry when the Feed marks it Seen, with the time it was Seen and its row', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await readLastCard(app, time);
    const second = idAt(app, 1);

    await look(app, time, 1);

    expect(app.history.list[0]).toEqual({
      entryId: second,
      seenAt: new Date(time.clock.now()),
      wordOfTheDay: false,
      row: await app.entryRow(second),
    });
  });

  it("marks the Word of the Day's card, and no other", async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });

    await readLastCard(app, time);
    await readLastCard(app, time);

    expect(app.history.list.map((entry) => [entry.entryId, entry.wordOfTheDay])).toEqual([
      [idAt(app, 1), false],
      [idAt(app, 0), true],
    ]);
  });

  it('records nothing for a card swiped past before it was Seen', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });

    await look(app, time, 0, SEEN_DWELL_MS - 1);

    expect(app.history.list).toEqual([]);
  });

  it('records nothing for an Entry opened from a list', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.favorites.add('w_three');

    await app.entryCard('w_three');
    await app.entryRow('w_three');

    expect(app.history.list).toEqual([]);
    expect(idsUnder(records, 'history.')).toEqual([]);
  });

  it('leaves History as it is when the reader goes back to a card already Seen in the Cycle', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await readLastCard(app, time);
    await readLastCard(app, time);
    const before = app.history.list;

    time.advance(60_000);
    await look(app, time, 0);

    expect(app.history.list).toBe(before);
  });

  it('keeps one entry per Entry, moving an Entry Seen again in a new Cycle to the top with the new time', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    while ((await readLastCard(app, time))?.kind !== 'end-of-cycle');
    const lastCycle = idsOf(app);

    // On the end-of-Cycle card, then the first card of the new Cycle.
    await app.feed.show(app.feed.cards.length - 1);
    await readLastCard(app, time);
    const again = idAt(app, app.feed.cards.length - 2);

    expect(idsOf(app)).toEqual([again, ...lastCycle.filter((id) => id !== again)]);
    expect(app.history.list[0]?.seenAt).toEqual(new Date(time.clock.now()));
    expect(idsUnder(records, 'history.')).toHaveLength(lastCycle.length);
  });

  it(`keeps the last ${String(HISTORY_CAP)} Entries, evicting the oldest in the same write`, async () => {
    const records = new Map<string, string>();
    const port = createMemoryUserStatePort(records);
    const writes: UserStateChanges[] = [];
    const time = fakeClock();
    const pack = Array.from({ length: HISTORY_CAP + 2 }, (_, index) => word(`w_${String(index)}`));
    const app = await run({
      clock: time.clock,
      pack,
      port: {
        ...port,
        write(changes) {
          writes.push(changes);
          return port.write(changes);
        },
      },
    });
    for (let seen = 0; seen < HISTORY_CAP; seen++) await readLastCard(app, time);
    const oldest = idAt(app, 0);
    expect(app.history.list).toHaveLength(HISTORY_CAP);

    writes.length = 0;
    await readLastCard(app, time);
    const newest = idAt(app, HISTORY_CAP);

    expect(app.history.list).toHaveLength(HISTORY_CAP);
    expect(idsOf(app)[0]).toBe(newest);
    expect(idsOf(app)).not.toContain(oldest);
    expect(idsUnder(records, 'history.')).toHaveLength(HISTORY_CAP);
    const write = writes.find((changes) => changes.has(`history.${newest}`));
    expect(write?.has(`feed.seen.${newest}`)).toBe(true);
    expect(write?.has(`history.${oldest}`)).toBe(true);
    expect(write?.get(`history.${oldest}`)).toBeUndefined();
  });

  it('survives a new Cycle and reopening, with the times and the Word of the Day flag', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    while ((await readLastCard(app, time))?.kind !== 'end-of-cycle');
    const lastCycle = app.history.list;

    // The card after the end-of-Cycle card starts the new Cycle.
    await app.feed.show(app.feed.cards.length - 1);
    expect(idsUnder(records, 'feed.seen.')).toEqual([]);

    expect(app.history.list).toBe(lastCycle);
    expect(lastCycle).toHaveLength(words.length - 1 + corrections.length);
    expect((await run({ records, clock: time.clock })).history.list).toEqual(lastCycle);
  });

  it('sees the same Seen marks as the Feed, also after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    await readLastCard(app, time);
    await readLastCard(app, time);
    await look(app, time, 2, 200);

    const seen = idsUnder(records, 'feed.seen.');
    expect(seen).toEqual([idAt(app, 0), idAt(app, 1)].sort());
    expect([...idsOf(app)].sort()).toEqual(seen);
    const reopened = await run({ records, clock: time.clock });
    expect([...idsOf(reopened)].sort()).toEqual(seen);
  });

  it('keeps one `history.` record per Entry', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });

    await readLastCard(app, time);
    await readLastCard(app, time);

    expect(idsUnder(records, 'history.')).toEqual([idAt(app, 0), idAt(app, 1)].sort());
  });

  it('keeps Retired Entries and skips an id the Language Pack does not have', async () => {
    const records = new Map<string, string>([
      ['history.w_old', JSON.stringify({ seenAt: '2026-10-10T07:00:00.000Z', wordOfTheDay: true })],
      [
        'history.w_gone',
        JSON.stringify({ seenAt: '2026-10-10T08:00:00.000Z', wordOfTheDay: false }),
      ],
    ]);

    const app = await run({ records });

    expect(app.history.list).toEqual([
      {
        entryId: 'w_old',
        seenAt: new Date('2026-10-10T07:00:00.000Z'),
        wordOfTheDay: true,
        row: await app.entryRow('w_old'),
      },
    ]);
  });

  it('records nothing in memory when keeping the Seen mark fails, as on disk', async () => {
    const records = new Map<string, string>();
    let failing = false;
    const port = createMemoryUserStatePort(records);
    const time = fakeClock();
    const app = await run({
      clock: time.clock,
      port: {
        ...port,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
      },
    });
    failing = true;

    await expect(look(app, time, 0)).rejects.toThrow('The disk is full');

    expect(app.history.list).toEqual([]);
    expect(idsUnder(records, 'history.')).toEqual([]);
    expect(idsUnder(records, 'feed.seen.')).toEqual([]);
  });

  describe('clear', () => {
    it('deletes every History record at once and nothing else', async () => {
      const records = new Map<string, string>();
      const time = fakeClock();
      const app = await run({ records, clock: time.clock });
      await app.favorites.add('w_three');
      await readLastCard(app, time);
      await readLastCard(app, time);
      // A record this app run never read, as sync may keep.
      records.set(
        'history.w_three',
        JSON.stringify({ seenAt: '2026-10-10T08:00:00.000Z', wordOfTheDay: false }),
      );
      const others = new Map([...records].filter(([key]) => !key.startsWith('history.')));

      await app.history.clear();

      expect(app.history.list).toEqual([]);
      expect(records).toEqual(others);
      expect(app.favorites.has('w_three')).toBe(true);
      expect((await run({ records, clock: time.clock })).history.list).toEqual([]);
    });

    it('lets the Feed record again after it', async () => {
      const time = fakeClock();
      const app = await run({ clock: time.clock });
      await readLastCard(app, time);

      await app.history.clear();
      await readLastCard(app, time);

      expect(idsOf(app)).toEqual([idAt(app, 1)]);
    });
  });

  describe('the snapshot', () => {
    it('is a new object after each change, telling the subscribers, and the same one otherwise', async () => {
      const time = fakeClock();
      const app = await run({ clock: time.clock });
      let told = 0;
      app.history.subscribe(() => {
        told += 1;
      });
      const empty = app.history.list;

      await app.history.clear();
      await look(app, time, 0, 200);
      expect(app.history.list).toBe(empty);
      expect(told).toBe(0);

      await look(app, time, 0);
      const recorded = app.history.list;
      expect(recorded).not.toBe(empty);
      expect(told).toBe(1);

      await app.history.clear();
      expect(app.history.list).not.toBe(recorded);
      expect(told).toBe(2);
    });

    it('stops telling a subscriber that unsubscribed', async () => {
      const time = fakeClock();
      const app = await run({ clock: time.clock });
      let told = 0;
      const stop = app.history.subscribe(() => {
        told += 1;
      });

      stop();
      await look(app, time, 0);

      expect(told).toBe(0);
    });
  });
});
