import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  entryIdOf,
  openComposition,
  openUserState,
  SEEN_DWELL_MS,
  type Category,
  type Clock,
  type Composition,
  type ContentReadPort,
  type Feed,
  type FeedCard,
  type UserStatePort,
} from '../index';
import { correction, fakeClock, word } from '../test-support';

/** The Language Pack's Categories, in its order. */
const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const crafts: Category = { id: 'crafts', displayName: 'Crafts' };
const categories = [nature, speech, crafts];

/**
 * A small pack: three live Words in each Category, and two live Corrections.
 * The Words' rarity runs 1 to 5 through the pack and starts again.
 */
const wordIdsOf = (category: Category) =>
  [0, 1, 2].map((index) => `w_${category.id}${String(index)}`);
const correctionIds = ['c_one', 'c_two'];
const rarityOf = new Map(
  categories.flatMap(wordIdsOf).map((id, index) => [id, (index % 5) + 1] as const),
);
const content = createMemoryContentPort({
  categories,
  words: categories.flatMap((category) =>
    wordIdsOf(category).map((id) =>
      word(id, { categoryId: category.id, rarity: rarityOf.get(id) ?? 1 }),
    ),
  ),
  corrections: correctionIds.map((id) => correction(id)),
});

const MINUTE = 60_000;

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  pack = content,
  port = createMemoryUserStatePort(records),
  clock = fakeClock().clock,
  defaultCategoryIds = categories.map(({ id }) => id),
  correctionsSwitch = true,
  rarityFloorSwitch = true,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  pack?: ContentReadPort;
  clock?: Clock;
  /** The Categories of the Edition's default Mix: every one of the pack, or these. */
  defaultCategoryIds?: 'all' | readonly string[];
  correctionsSwitch?: boolean;
  rarityFloorSwitch?: boolean;
} = {}): Promise<Composition> {
  return openComposition({
    content: pack,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) =>
        (feature === 'corrections' && correctionsSwitch) ||
        (feature === 'rarityFloor' && rarityFloorSwitch),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: { categoryIds: defaultCategoryIds, corrections: true },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port }),
    clock,
    random: { next: () => 0.25 },
  });
}

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => entryIdOf(card) ?? []);

/**
 * The ids of every Entry the Feed offers from where it stands, after the
 * cards so far, until it repeats, reaches the end of the Cycle or runs out.
 */
async function walk(feed: Feed): Promise<string[]> {
  const ids = entryIdsOf(feed.cards);
  for (;;) {
    const id = entryIdOf(await feed.next());
    if (id === undefined || ids.includes(id)) return ids;
    ids.push(id);
  }
}

/** The ids the Feed offers past the cards it holds already. */
async function offeredNext(feed: Feed): Promise<string[]> {
  const held = entryIdsOf(feed.cards).length;
  return (await walk(feed)).slice(held);
}

/**
 * Reads every card of the current Cycle to its end, each long enough to be
 * Seen, and swipes on to the first card of the next Cycle. Returns the ids
 * of the Entries read.
 */
async function readToTheNextCycle(feed: Feed, time: ReturnType<typeof fakeClock>) {
  const read: string[] = [];
  for (let position = feed.startPosition; ; position += 1) {
    await feed.show(position);
    const card = feed.cards[position];
    if (card?.kind === 'end-of-cycle') {
      await feed.show(position + 1);
      return read;
    }
    read.push(entryIdOf(card) ?? '');
    time.advance(SEEN_DWELL_MS);
  }
}

/** The Mix records the user state keeps, by key. */
const mixRecordsOf = (records: Map<string, string>) =>
  Object.fromEntries([...records].filter(([key]) => key.startsWith('mix.')));

const isWordOf = (category: Category) => (id: string) => wordIdsOf(category).includes(id);
const isCorrection = (id: string) => id.startsWith('c_');
/** Whether the id is a Word below the Rarity Floor. */
const isWordBelow = (floor: number) => (id: string) => (rarityOf.get(id) ?? floor) < floor;

describe('the Mix', () => {
  it('starts as the Edition default: every Category and Corrections in, no Hidden Category', async () => {
    const app = await run();

    expect(app.mix.state).toEqual({
      allCategories: categories,
      categoryIds: ['nature', 'speech', 'crafts'],
      corrections: true,
      hiddenCategories: [],
      lastCategoryId: undefined,
      rarityFloor: 1,
    });
  });

  it('takes a Category out and puts it back, one `mix.categories.` record per Category', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    expect(await app.mix.takeOut('speech')).toBe(true);

    expect(app.mix.state.categoryIds).toEqual(['nature', 'crafts']);
    expect(app.mix.state.hiddenCategories).toEqual([speech]);
    expect(mixRecordsOf(records)).toEqual({ 'mix.categories.speech': 'false' });

    await app.mix.putBack('speech');

    expect(app.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
    expect(app.mix.state.hiddenCategories).toEqual([]);
    expect(mixRecordsOf(records)).toEqual({ 'mix.categories.speech': 'true' });
  });

  it('lists the Hidden Categories in the Language Pack order, whatever the order they were taken out in', async () => {
    const app = await run();

    await app.mix.takeOut('crafts');
    await app.mix.takeOut('nature');

    expect(app.mix.state.hiddenCategories).toEqual([nature, crafts]);
    expect(app.mix.state.categoryIds).toEqual(['speech']);
  });

  it('refuses to take out the last Category, and names it', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.mix.takeOut('nature');
    expect(app.mix.state.lastCategoryId).toBeUndefined();
    await app.mix.takeOut('crafts');
    const state = app.mix.state;

    expect(state.lastCategoryId).toBe('speech');
    expect(await app.mix.takeOut('speech')).toBe(false);

    expect(app.mix.state).toBe(state);
    expect(state.categoryIds).toEqual(['speech']);
    expect(records.has('mix.categories.speech')).toBe(false);
  });

  it('applies the Edition default to every Category the user never touched', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, defaultCategoryIds: ['speech'] });

    expect(app.mix.state.categoryIds).toEqual(['speech']);
    expect(app.mix.state.hiddenCategories).toEqual([nature, crafts]);
    expect(app.mix.state.lastCategoryId).toBe('speech');
    expect(new Set(await walk(app.feed))).toEqual(
      new Set([...wordIdsOf(speech), ...correctionIds]),
    );

    await app.mix.putBack('crafts');
    // A later default, such as one that comes with a Category added by a content update.
    const updated = await run({ records, defaultCategoryIds: ['nature', 'speech'] });

    expect(updated.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
    const later = await run({ records, defaultCategoryIds: [] });
    expect(later.mix.state.categoryIds).toEqual(['crafts']);
  });

  it('keeps the default Categories in when the records and a later default would leave none', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.mix.takeOut('nature');
    await first.mix.takeOut('speech');
    await first.mix.putBack('nature');
    await first.mix.takeOut('crafts');
    // A later default without the one Category the user kept in, by the default before.
    records.delete('mix.categories.nature');
    const app = await run({ records, defaultCategoryIds: ['speech'] });

    expect(app.mix.state.categoryIds).toEqual(['speech']);
    expect(app.mix.state.lastCategoryId).toBe('speech');
    expect(new Set(await walk(app.feed))).toEqual(
      new Set([...wordIdsOf(speech), ...correctionIds]),
    );

    await app.mix.putBack('crafts');

    expect(app.mix.state.categoryIds).toEqual(['speech', 'crafts']);
    const reopened = await run({ records, defaultCategoryIds: ['speech'] });
    expect(reopened.mix.state).toEqual(app.mix.state);
  });

  it('reads a Mix with no Category in it, as a merge of two devices can leave, as the Edition default of every Category, and writes nothing for it', async () => {
    // Each device took out a different last Category.
    const records = new Map(
      categories.map(({ id }) => [`mix.categories.${id}`, JSON.stringify(false)]),
    );
    const mixRecords = mixRecordsOf(records);

    const app = await run({ records, defaultCategoryIds: 'all' });

    expect(app.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
    expect(app.mix.state.hiddenCategories).toEqual([]);
    expect(new Set(await walk(app.feed))).toEqual(
      new Set([...categories.flatMap(wordIdsOf), ...correctionIds]),
    );
    expect(mixRecordsOf(records)).toEqual(mixRecords);
  });

  describe('over a Language Pack with a new Category', () => {
    const military: Category = { id: 'military', displayName: 'Military' };
    const updated = createMemoryContentPort({
      categories: [...categories, military],
      words: [...categories, military].flatMap((category) =>
        wordIdsOf(category).map((id) => word(id, { categoryId: category.id })),
      ),
      corrections: correctionIds.map((id) => correction(id)),
    });

    it('takes it into a Mix that follows an «all» default, with its name and its Words eligible', async () => {
      const records = new Map<string, string>();
      await (await run({ records, defaultCategoryIds: 'all' })).mix.takeOut('speech');

      const app = await run({ records, pack: updated, defaultCategoryIds: 'all' });

      expect(app.mix.state.allCategories).toEqual([...categories, military]);
      // A Category the user never touched follows the Edition's default (ADR 0019).
      expect(app.mix.state.categoryIds).toEqual(['nature', 'crafts', 'military']);
      expect(app.mix.state.hiddenCategories).toEqual([speech]);
      const offered = await walk(app.feed);
      expect(offered.filter(isWordOf(military))).not.toEqual([]);
      expect(offered.filter(isWordOf(speech))).toEqual([]);
      const card = await app.entryCard(wordIdsOf(military)[0] ?? '');
      expect(card?.kind === 'word' ? card.wordCard.categoryName : undefined).toBe('Military');
    });

    it('keeps it out of a Mix whose default lists the Categories, as a Hidden Category', async () => {
      const records = new Map<string, string>();
      const listed = categories.map(({ id }) => id);
      await (await run({ records, defaultCategoryIds: listed })).mix.takeOut('speech');

      const app = await run({ records, pack: updated, defaultCategoryIds: listed });

      expect(app.mix.state.categoryIds).toEqual(['nature', 'crafts']);
      expect(app.mix.state.hiddenCategories).toEqual([speech, military]);
      expect((await walk(app.feed)).filter(isWordOf(military))).toEqual([]);

      await app.mix.putBack('military');

      expect((await walk(app.feed)).filter(isWordOf(military))).not.toEqual([]);
    });
  });

  it('keeps every Category in when the Language Pack has none of the default ones', async () => {
    const app = await run({ defaultCategoryIds: ['gone'] });

    expect(app.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
    expect(app.mix.state.hiddenCategories).toEqual([]);
  });

  it('turns every Category on at once, leaving Corrections as they are', async () => {
    const records = new Map<string, string>();
    const app = await run({ records, defaultCategoryIds: ['speech'] });
    await app.mix.setCorrections(false);

    await app.mix.turnAllOn();

    expect(app.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
    expect(app.mix.state.corrections).toBe(false);
    expect(mixRecordsOf(records)).toEqual({
      'mix.categories.nature': 'true',
      'mix.categories.crafts': 'true',
      'mix.corrections': 'false',
    });
  });

  it('turns Corrections off and on with the `mix.corrections` record', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await app.mix.setCorrections(false);

    expect(app.mix.state.corrections).toBe(false);
    expect(records.get('mix.corrections')).toBe('false');

    await app.mix.setCorrections(true);

    expect(app.mix.state.corrections).toBe(true);
    expect(records.get('mix.corrections')).toBe('true');
  });

  it('sets the Rarity Floor with the `mix.rarityFloor` record, and skips one that is no rarity', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await app.mix.setRarityFloor(4);

    expect(app.mix.state.rarityFloor).toBe(4);
    expect(records.get('mix.rarityFloor')).toBe('4');

    await app.mix.setRarityFloor(0);
    await app.mix.setRarityFloor(6);
    await app.mix.setRarityFloor(2.5);

    expect(app.mix.state.rarityFloor).toBe(4);
    expect(records.get('mix.rarityFloor')).toBe('4');

    await app.mix.setRarityFloor(1);

    expect(app.mix.state.rarityFloor).toBe(1);
    expect(records.get('mix.rarityFloor')).toBe('1');
  });

  it('skips a Category the Language Pack does not have', async () => {
    const records = new Map<string, string>();
    records.set('mix.categories.military', JSON.stringify(true));
    const app = await run({ records });

    expect(await app.mix.takeOut('history')).toBe(false);
    await app.mix.putBack('poetry');

    expect(app.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
    expect(mixRecordsOf(records)).toEqual({ 'mix.categories.military': 'true' });
  });

  it('survives reopening', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.mix.takeOut('nature');
    await first.mix.setCorrections(false);
    await first.mix.setRarityFloor(3);

    const app = await run({ records });

    expect(app.mix.state).toEqual(first.mix.state);
    expect(app.mix.state).toMatchObject({
      categoryIds: ['speech', 'crafts'],
      corrections: false,
      rarityFloor: 3,
    });
  });

  it('changes nothing in memory when keeping the change fails', async () => {
    const records = new Map<string, string>();
    const port = createMemoryUserStatePort(records);
    let failing = false;
    const app = await run({
      port: {
        ...port,
        write: (changes) =>
          failing ? Promise.reject(new Error('The disk is full')) : port.write(changes),
      },
    });
    await app.mix.takeOut('nature');
    const state = app.mix.state;
    failing = true;

    await expect(app.mix.takeOut('speech')).rejects.toThrow('The disk is full');
    await expect(app.mix.putBack('nature')).rejects.toThrow('The disk is full');
    await expect(app.mix.turnAllOn()).rejects.toThrow('The disk is full');
    await expect(app.mix.setCorrections(false)).rejects.toThrow('The disk is full');
    await expect(app.mix.setRarityFloor(5)).rejects.toThrow('The disk is full');

    expect(app.mix.state).toBe(state);
    const offered = await offeredNext(app.feed);
    expect(offered.filter(isWordOf(nature))).toEqual([]);
    expect(offered.filter(isWordOf(speech))).not.toEqual([]);
    expect(offered.filter(isCorrection)).not.toEqual([]);
  });

  describe('the snapshot', () => {
    it('is a new object after each change, telling the subscribers, and the same one otherwise', async () => {
      const app = await run();
      let told = 0;
      app.mix.subscribe(() => {
        told += 1;
      });
      const all = app.mix.state;

      await app.mix.putBack('speech');
      await app.mix.turnAllOn();
      await app.mix.setCorrections(true);
      await app.mix.setRarityFloor(1);
      expect(app.mix.state).toBe(all);
      expect(told).toBe(0);

      await app.mix.takeOut('speech');
      const out = app.mix.state;
      expect(out).not.toBe(all);
      await app.mix.takeOut('speech');
      expect(app.mix.state).toBe(out);
      expect(told).toBe(1);

      await app.mix.setCorrections(false);
      expect(app.mix.state).not.toBe(out);
      expect(told).toBe(2);

      const corrections = app.mix.state;
      await app.mix.setRarityFloor(2);
      expect(app.mix.state).not.toBe(corrections);
      expect(told).toBe(3);
    });

    it('stops telling a subscriber that unsubscribed', async () => {
      const app = await run();
      let told = 0;
      const stop = app.mix.subscribe(() => {
        told += 1;
      });

      stop();
      await app.mix.takeOut('speech');

      expect(told).toBe(0);
    });
  });
});

describe('eligibility over the Mix', () => {
  it('Corrections out of the Mix means no Correction cards, in this Cycle, the next one and after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });

    await app.mix.setCorrections(false);

    expect((await offeredNext(app.feed)).filter(isCorrection)).toEqual([]);
    expect((await readToTheNextCycle(app.feed, time)).slice(2).filter(isCorrection)).toEqual([]);
    expect((await walk(app.feed)).filter(isCorrection)).toEqual([]);
    const reopened = await run({ records, clock: time.clock });
    expect((await walk(reopened.feed)).filter(isCorrection)).toEqual([]);
  });

  it('holds no Correction while the Edition turns Corrections off, even with Corrections in the Mix', async () => {
    const app = await run({ correctionsSwitch: false });

    expect(app.mix.state.corrections).toBe(true);
    expect((await walk(app.feed)).filter(isCorrection)).toEqual([]);
  });

  it('a Hidden Category is exactly a Category out of the Mix: none of its Words is offered until it is put back', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const twin = await walk((await run()).feed);
    // A Category none of whose Words the Feed holds yet.
    const held = entryIdsOf(app.feed.cards);
    const hidden =
      categories.find((category) => !held.some(isWordOf(category))) ?? categories[0] ?? nature;

    await app.mix.takeOut(hidden.id);

    expect(app.mix.state.hiddenCategories).toEqual([hidden]);
    expect(await walk(app.feed)).toEqual(twin.filter((id) => !isWordOf(hidden)(id)));
    expect((await readToTheNextCycle(app.feed, time)).filter(isWordOf(hidden))).toEqual([]);
    const reopened = await run({ records, clock: time.clock });
    expect((await walk(reopened.feed)).filter(isWordOf(hidden))).toEqual([]);

    await reopened.mix.putBack(hidden.id);

    expect(reopened.mix.state.hiddenCategories).toEqual([]);
    expect((await walk(reopened.feed)).filter(isWordOf(hidden))).not.toEqual([]);
  });

  it('a Mix change keeps what is Seen, the seed and the order of the Entries that stay', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const twin = await walk((await run()).feed);
    await app.feed.show(0);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(1);
    const seen = entryIdOf(app.feed.cards[0]) ?? '';
    const cycle = records.get('feed.cycle');
    const held = entryIdsOf(app.feed.cards);
    const hidden = categories.find((category) => !held.some(isWordOf(category))) ?? nature;

    await app.mix.takeOut(hidden.id);
    await app.mix.setCorrections(false);

    expect(records.get('feed.cycle')).toBe(cycle);
    expect(records.get(`feed.seen.${seen}`)).toBe('1');
    const words = (ids: readonly string[]) => ids.filter((id) => id.startsWith('w_'));
    expect(words(await walk(app.feed))).toEqual(words(twin).filter((id) => !isWordOf(hidden)(id)));
  });

  it('a Category put back and Corrections turned on again take back their places in the Cycle', async () => {
    const app = await run();
    const twin = await walk((await run()).feed);
    const held = entryIdsOf(app.feed.cards);
    const hidden = categories.find((category) => !held.some(isWordOf(category))) ?? nature;

    await app.mix.takeOut(hidden.id);
    await app.mix.setCorrections(false);
    await app.mix.turnAllOn();
    await app.mix.setCorrections(true);

    expect(await walk(app.feed)).toEqual(twin);
  });

  it('a Category taken out leaves the Feed at once, the card on screen included, and comes back where it was when put back', async () => {
    const app = await run();
    await app.feed.show(0);
    await app.feed.show(1);
    const before = entryIdsOf(app.feed.cards);
    const onScreen = before[1] ?? '';
    const hidden = categories.find((category) => isWordOf(category)(onScreen)) ?? nature;

    await app.mix.takeOut(hidden.id);

    expect(entryIdsOf(app.feed.cards).filter(isWordOf(hidden))).toEqual([]);
    expect(entryIdsOf(app.feed.cards).slice(0, 1)).toEqual(
      before.filter((id) => !isWordOf(hidden)(id)).slice(0, 1),
    );
    expect(app.feed.cards[app.feed.position + 1]).toBeDefined();

    await app.mix.putBack(hidden.id);

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(entryIdOf(app.feed.cards[app.feed.position])).toBe(onScreen);
  });

  it('a Category taken out with the card on screen and the next one puts a new card on screen in the same change, and keeps the reader’s place on it', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const categoryOf = (card: FeedCard | undefined) =>
      categories.find((category) => isWordOf(category)(entryIdOf(card) ?? ''));
    // Reads on, past the Word of the Day, to a Word card whose ready card is a
    // Word of the same Category.
    await app.feed.show(app.feed.startPosition);
    let position = app.feed.startPosition + 1;
    await app.feed.show(position);
    while (
      categoryOf(app.feed.cards[position]) === undefined ||
      categoryOf(app.feed.cards[position]) !== categoryOf(app.feed.cards[position + 1])
    ) {
      position += 1;
      expect(position).toBeLessThan(categories.length * 3);
      await app.feed.show(position);
    }
    const before = entryIdsOf(app.feed.cards);
    const onScreen = before[position] ?? '';
    const hidden = categoryOf(app.feed.cards[position]) ?? nature;
    /** What a subscriber finds on each change: whether the card on screen is there. */
    const told: boolean[] = [];
    app.feed.subscribe(() => {
      told.push(app.feed.cards[app.feed.position] !== undefined);
    });

    await app.mix.takeOut(hidden.id);

    expect(told).not.toContain(false);
    const now = app.feed.cards[app.feed.position];
    expect(now?.kind).not.toBe('end-of-cycle');
    expect(isWordOf(hidden)(entryIdOf(now) ?? '')).toBe(false);
    expect(app.feed.cards[app.feed.position + 1]).toBeDefined();
    time.advance(MINUTE);
    const reopened = await run({ records, clock: time.clock });
    expect(entryIdOf(reopened.feed.cards[reopened.feed.startPosition])).toBe(entryIdOf(now));

    await app.mix.putBack(hidden.id);

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(entryIdOf(app.feed.cards[app.feed.position])).toBe(onScreen);
  });

  it('a Rarity Floor of 4 leaves only Words of rarity 4 and 5, and every Correction, in this Cycle, the next one and after reopening', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });

    await app.mix.setRarityFloor(4);

    const offered = await walk(app.feed);
    expect(offered.filter(isWordBelow(4))).toEqual([]);
    expect(offered.filter((id) => id.startsWith('w_'))).not.toEqual([]);
    expect(offered.filter(isCorrection).sort()).toEqual(correctionIds);
    const next = await readToTheNextCycle(app.feed, time);
    expect(next.filter(isWordBelow(4))).toEqual([]);
    expect(next.filter(isCorrection).sort()).toEqual(correctionIds);
    const reopened = await run({ records, clock: time.clock });
    expect((await walk(reopened.feed)).filter(isWordBelow(4))).toEqual([]);
  });

  it('a Rarity Floor change keeps what is Seen, the seed and the order of the Entries that stay', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const app = await run({ records, clock: time.clock });
    const twin = await walk((await run()).feed);
    await app.feed.show(0);
    time.advance(SEEN_DWELL_MS);
    await app.feed.show(1);
    const seen = entryIdOf(app.feed.cards[0]) ?? '';
    const cycle = records.get('feed.cycle');
    const held = entryIdsOf(app.feed.cards);

    await app.mix.setRarityFloor(5);

    expect(records.get('feed.cycle')).toBe(cycle);
    expect(records.get(`feed.seen.${seen}`)).toBe('1');
    const words = (ids: readonly string[]) =>
      ids.filter((id) => id.startsWith('w_') && !held.includes(id));
    expect(words(await walk(app.feed))).toEqual(words(twin).filter((id) => !isWordBelow(5)(id)));
  });

  it('a Rarity Floor lowered again gives the Words back their places in the Cycle', async () => {
    const app = await run();
    const twin = await walk((await run()).feed);

    await app.mix.setRarityFloor(5);
    await app.mix.setRarityFloor(1);

    // The cards the Feed holds stay; the Words after them follow the Cycle order.
    const held = entryIdsOf(app.feed.cards);
    const words = (ids: readonly string[]) =>
      ids.filter((id) => id.startsWith('w_') && !held.includes(id));
    expect(words(await walk(app.feed))).toEqual(words(twin));
  });

  it('a Rarity Floor narrows nothing while the Edition turns its rarityFloor switch off', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).mix.setRarityFloor(5);

    const app = await run({ records, rarityFloorSwitch: false });

    expect(app.mix.state.rarityFloor).toBe(5);
    expect(new Set(await walk(app.feed))).toEqual(
      new Set([...categories.flatMap(wordIdsOf), ...correctionIds]),
    );
  });

  it('a Word of the Day whose Category is taken out is chosen again', async () => {
    const records = new Map<string, string>();
    const time = fakeClock();
    const first = await run({ records, clock: time.clock });
    const wordOfTheDay = entryIdOf(first.feed.cards[0]) ?? '';
    const category = categories.find((each) => isWordOf(each)(wordOfTheDay)) ?? nature;

    await first.mix.takeOut(category.id);
    time.advance(MINUTE);
    const app = await run({ records, clock: time.clock });

    const opening = app.feed.cards[app.feed.startPosition];
    expect(opening).toMatchObject({
      kind: 'word',
      wordOfTheDay: { year: 2026, month: 10, day: 11 },
    });
    expect(isWordOf(category)(entryIdOf(opening) ?? '')).toBe(false);
  });
});

describe('linked Corrections («Часто кажуть») over the Mix', () => {
  const linked = word('w_linked', { categoryId: 'nature', correctionIds: ['c_one', 'c_two'] });
  const pack = createMemoryContentPort({
    categories,
    words: [
      linked,
      ...categories.flatMap((category) =>
        wordIdsOf(category).map((id) => word(id, { categoryId: category.id })),
      ),
    ],
    corrections: correctionIds.map((id) => correction(id)),
  });
  const links = [
    { correctionId: 'c_one', nonStandardForm: 'not one' },
    { correctionId: 'c_two', nonStandardForm: 'not two' },
  ];

  /** The linked Corrections of the Word's card in the Feed, once the Feed holds it. */
  async function feedLinks(app: Composition) {
    while (!entryIdsOf(app.feed.cards).includes(linked.id)) {
      if ((await app.feed.next()) === undefined) break;
    }
    const card = app.feed.cards.find((shown) => entryIdOf(shown) === linked.id);
    return { card, links: card?.kind === 'word' ? card.wordCard.linkedCorrections : undefined };
  }

  /** The linked Corrections of the Word on the Entry screen. */
  async function entryScreenLinks(app: Composition) {
    const card = await app.entryCard(linked.id);
    return card?.kind === 'word' ? card.wordCard.linkedCorrections : undefined;
  }

  it('leaves the block off the Entry screen while Corrections are out of the Mix, and brings it back with them', async () => {
    const app = await run({ pack });
    expect(await entryScreenLinks(app)).toEqual(links);

    await app.mix.setCorrections(false);
    expect(await entryScreenLinks(app)).toEqual([]);

    await app.mix.setCorrections(true);
    expect(await entryScreenLinks(app)).toEqual(links);
  });

  it('leaves the block off the Entry screen after reopening with Corrections out of the Mix', async () => {
    const records = new Map<string, string>();
    await (await run({ records, pack })).mix.setCorrections(false);

    expect(await entryScreenLinks(await run({ records, pack }))).toEqual([]);
  });

  it('keeps the block while only a Category is out of the Mix', async () => {
    const app = await run({ pack });

    await app.mix.takeOut('speech');

    expect(await entryScreenLinks(app)).toEqual(links);
  });

  it('takes the block off a Word card already in the Feed, and puts it back, at once', async () => {
    const app = await run({ pack });
    const before = await feedLinks(app);
    expect(before.links).toEqual(links);
    let told = 0;
    app.feed.subscribe(() => {
      told += 1;
    });
    const position = entryIdsOf(app.feed.cards).indexOf(linked.id);

    await app.mix.setCorrections(false);

    expect(told).toBeGreaterThan(0);
    const out = app.feed.cards[position];
    expect(out).not.toBe(before.card);
    expect(entryIdOf(out)).toBe(linked.id);
    expect(out?.kind === 'word' ? out.wordCard.linkedCorrections : undefined).toEqual([]);
    expect(await app.feed.openLinkedCorrection(position, 'c_one')).toBeUndefined();
    const toldOut = told;

    await app.mix.setCorrections(true);

    expect(told).toBeGreaterThan(toldOut);
    const back = app.feed.cards[position];
    expect(back?.kind === 'word' ? back.wordCard.linkedCorrections : undefined).toEqual(links);
    expect(await app.feed.openLinkedCorrection(position, 'c_one')).toBe(position + 1);
  });

  it('keeps the cards of the Feed as they are when the Mix change leaves the block alone', async () => {
    const app = await run({ pack });
    await feedLinks(app);
    const cards = app.feed.cards;

    await app.mix.takeOut('crafts');
    await app.mix.putBack('crafts');

    expect(app.feed.cards).toEqual(cards);
  });
});
