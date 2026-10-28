import { SpotlightSnapshotSchema, type Category, type SpotlightSnapshot } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  SEEN_DWELL_MS,
  openUserState,
  type Clock,
  type Composition,
} from '../index';
import { createMemoryContentPort } from '../testing';
import { correction, fakeClock, idiom, steppingRandom, word } from '../test-support';

/** The instant these tests start at. */
const start = '2026-10-28T09:00:00+03:00';

const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const categories = [nature, speech];

/** A small pack: live Words in two Categories, a Retired Word, a Correction and an Idiom. */
const pack = createMemoryContentPort({
  categories,
  words: [
    word('w_sumyrnyi', { lemma: 'сумирний', stress: [3], categoryId: 'nature' }),
    word('w_lahidnyi', { lemma: 'лагідний', stress: [3], categoryId: 'nature' }),
    word('w_movchaz', { lemma: 'мовчазний', categoryId: 'speech' }),
    word('w_old', { lemma: 'давній', categoryId: 'nature', retired: true }),
  ],
  corrections: [correction('c_one')],
  idioms: [idiom('i_one')],
});

/** The Edition's words the snapshot is written with. */
const strings = {
  notificationBody: { ellipsis: '…', tipStandardForm: 'Так: {form}' },
  spotlight: {
    collection: {
      one: 'Колекція · {count} слово',
      few: 'Колекція · {count} слова',
      many: 'Колекція · {count} слів',
      other: 'Колекція · {count} слова',
    },
  },
};

const MINUTE = 60_000;

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock(start).clock,
  withSpotlight = true,
}: {
  records?: Map<string, string>;
  clock?: Clock;
  /** Whether the Feature Switch `spotlight` is on, as the Edition in effect has it. */
  withSpotlight?: boolean;
} = {}): Promise<Composition> {
  return openComposition({
    content: pack,
    edition: {
      id: 'test',
      locale: 'uk',
      isFeatureEnabled: (feature) =>
        feature === 'spotlight'
          ? withSpotlight
          : feature === 'corrections' || feature === 'idioms' || feature === 'wordOfTheDayArchive',
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: categories.map(({ id }) => id),
          correctionCategoryIds: 'all' as const,
          corrections: true,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: steppingRandom(),
  });
}

/** The Spotlight Snapshot, checked against its contract. */
async function snapshotOf(app: Composition): Promise<SpotlightSnapshot> {
  return SpotlightSnapshotSchema.parse(await app.spotlight.snapshot(strings));
}

/** The ids of the Entries the snapshot indexes, in its order. */
const entryIdsOf = (snapshot: SpotlightSnapshot) => snapshot.entries.map(({ entry }) => entry.id);

/** A new Collection; it fails the test when it isn't created. */
async function collection(app: Composition, name: string) {
  const created = await app.collections.create(name);
  if (!created.ok) throw new Error(`The Collection ${name} was not created`);
  return created.collection.id;
}

/** Records with the Word of the Day archive keeping `wordId` on each of `dates`. */
const withArchive = (days: Record<string, string>) =>
  new Map(
    Object.entries(days).map(([date, wordId]) => [
      `wordOfTheDayArchive.${date}`,
      JSON.stringify(wordId),
    ]),
  );

describe('The Spotlight Snapshot', () => {
  it('indexes nothing while the reader keeps nothing', async () => {
    expect(await snapshotOf(await run())).toEqual({ entries: [], collections: [] });
  });

  it('indexes each Entry of Favorites, the Collections and the archive once, as the widget shows it, with its route', async () => {
    const { clock, advance } = fakeClock(start);
    const app = await run({
      records: withArchive({ '2026-10-26': 'w_sumyrnyi', '2026-10-27': 'w_lahidnyi' }),
      clock,
    });
    await app.favorites.add('w_sumyrnyi');
    advance(MINUTE);
    await app.favorites.add('c_one');
    const letters = await collection(app, 'Letters');
    await app.collections.add(letters, 'c_one');
    await app.collections.add(letters, 'i_one');
    const more = await collection(app, 'More');
    await app.collections.add(more, 'i_one');
    await app.collections.add(more, 'w_sumyrnyi');

    const snapshot = await snapshotOf(app);

    expect([...entryIdsOf(snapshot)].sort()).toEqual(
      ['c_one', 'i_one', 'w_lahidnyi', 'w_sumyrnyi'].sort(),
    );
    expect(snapshot.entries).toContainEqual({
      entry: {
        kind: 'word',
        id: 'w_lahidnyi',
        headline: 'лагі́дний',
        secondLine: expect.any(String) as unknown,
        voiceOver: expect.stringMatching(/^лагідний, /) as unknown,
      },
      route: 'entry/w_lahidnyi',
    });
    expect(snapshot.entries.map(({ entry }) => entry.kind).sort()).toEqual(
      ['correction', 'idiom', 'word', 'word'].sort(),
    );
    expect(snapshot.entries.every(({ entry, route }) => route === `entry/${entry.id}`)).toBe(true);
  });

  it('indexes every Collection, empty ones too, by its name, its count in plural forms and its route', async () => {
    const { clock, advance } = fakeClock(start);
    const app = await run({ clock });
    const empty = await collection(app, 'Порожня');
    advance(MINUTE);
    const one = await collection(app, 'Одне');
    await app.collections.add(one, 'w_sumyrnyi');
    advance(MINUTE);
    const three = await collection(app, 'Три');
    for (const id of ['w_sumyrnyi', 'w_lahidnyi', 'c_one']) await app.collections.add(three, id);

    expect((await snapshotOf(app)).collections).toEqual([
      {
        id: three,
        name: 'Три',
        secondLine: 'Колекція · 3 слова',
        route: `saved/collections/${three}`,
      },
      {
        id: one,
        name: 'Одне',
        secondLine: 'Колекція · 1 слово',
        route: `saved/collections/${one}`,
      },
      {
        id: empty,
        name: 'Порожня',
        secondLine: 'Колекція · 0 слів',
        route: `saved/collections/${empty}`,
      },
    ]);
  });

  it('leaves out Hidden and Retired Entries, though the reader keeps them and the archive has them', async () => {
    const app = await run({ records: withArchive({ '2026-10-26': 'w_old' }) });
    const kept = await collection(app, 'Kept');
    for (const id of ['w_sumyrnyi', 'w_lahidnyi', 'w_old', 'w_movchaz']) {
      await app.favorites.add(id);
      await app.collections.add(kept, id);
    }
    await app.hide({ kind: 'entry', entryId: 'w_lahidnyi' });
    await app.hide({ kind: 'category', categoryId: 'speech' });

    expect(entryIdsOf(await snapshotOf(app))).toEqual(['w_sumyrnyi']);
  });

  it('drops an Entry once it leaves its last list, unfavorited and out of every Collection', async () => {
    const app = await run();
    const kept = await collection(app, 'Kept');
    await app.favorites.add('w_sumyrnyi');
    await app.collections.add(kept, 'w_sumyrnyi');

    await app.favorites.remove('w_sumyrnyi');
    expect(entryIdsOf(await snapshotOf(app))).toEqual(['w_sumyrnyi']);

    await app.collections.remove(kept, 'w_sumyrnyi');
    expect(entryIdsOf(await snapshotOf(app))).toEqual([]);
  });

  it('is empty while the Feature Switch `spotlight` is off, whatever the reader keeps', async () => {
    const records = withArchive({ '2026-10-26': 'w_sumyrnyi' });
    const on = await run({ records });
    await on.favorites.add('c_one');
    await collection(on, 'Kept');

    const off = await run({ records, withSpotlight: false });

    expect(await snapshotOf(off)).toEqual({ entries: [], collections: [] });
  });
});

describe('The Spotlight Snapshot changing', () => {
  it('tells its listener after each change of Favorites, the Collections and the archive, until it stops', async () => {
    const time = fakeClock(start);
    const app = await run({ clock: time.clock });
    let told = 0;
    const stop = app.spotlight.subscribe(() => {
      told += 1;
    });
    /** Shows the card at `position` long enough to be Seen and takes it off screen. */
    const look = async (position: number) => {
      await app.feed.show(position);
      time.advance(SEEN_DWELL_MS);
      await app.feed.show(undefined);
    };

    await app.favorites.add('w_sumyrnyi');
    expect(told).toBe(1);
    const kept = await collection(app, 'Kept');
    expect(told).toBe(2);
    await app.collections.add(kept, 'c_one');
    expect(told).toBe(3);

    const today = app.feed.cards[0]?.entryId;
    await look(0);
    expect(told).toBe(4);
    expect(entryIdsOf(await snapshotOf(app))).toContain(today);

    await look(1);
    expect(told).toBe(4);

    stop();
    await app.favorites.add('w_lahidnyi');
    expect(told).toBe(4);
  });
});
