import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  entryIdOf,
  openComposition,
  openUserState,
  type Category,
  type Clock,
  type Composition,
  type Feed,
  type FeedCard,
} from './index';

function word(id: string, categoryId: string): Word {
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
    categoryId,
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
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

/** The Edition's Categories, in its order. */
const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const crafts: Category = { id: 'crafts', displayName: 'Crafts' };
const categories = [nature, speech, crafts];

/** A small pack: three live Words in each Category, and two live Corrections. */
const wordIdsOf = (category: Category) =>
  [0, 1, 2].map((index) => `w_${category.id}${String(index)}`);
const content = createMemoryContentPort({
  words: categories.flatMap((category) => wordIdsOf(category).map((id) => word(id, category.id))),
  corrections: ['c_one', 'c_two'].map((id) => correction(id)),
});

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

const MINUTE = 60_000;

/** The Core composition of one app run over the records. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock().clock,
}: {
  records?: Map<string, string>;
  clock?: Clock;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      isFeatureEnabled: (feature) => feature === 'corrections',
      categories,
      userSettingDefaults: {
        mix: { categoryIds: categories.map(({ id }) => id), corrections: true },
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
}

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => entryIdOf(card) ?? []);

/** Shows every card up to `position`, as the reader swiping to it. */
async function turnTo(feed: Feed, position: number): Promise<void> {
  for (let page = 0; page <= position; page += 1) await feed.show(page);
}

/** The ids of the Hidden Entries, newest first. */
const hiddenIdsOf = ({ hiddenEntries }: Composition) =>
  hiddenEntries.list.map(({ entryId }) => entryId);

const isWordOf = (category: Category) => (id: string) => wordIdsOf(category).includes(id);
const isCorrection = (id: string) => id.startsWith('c_');

describe('a hide', () => {
  it('hides an Entry, gives its row for the toast, and its undo restores it', async () => {
    const app = await run();

    const hidden = await app.hide({ kind: 'entry', entryId: 'w_speech1' });

    expect(hidden?.changed).toEqual({
      kind: 'entry',
      entryId: 'w_speech1',
      row: await app.entryRow('w_speech1'),
    });
    expect(app.hiddenEntries.has('w_speech1')).toBe(true);

    await hidden?.undo();

    expect(app.hiddenEntries.has('w_speech1')).toBe(false);
  });

  it('changes nothing for an Entry Hidden already, and keeps the time it was hidden', async () => {
    const time = fakeClock();
    const records = new Map<string, string>();
    const app = await run({ records, clock: time.clock });
    await app.hide({ kind: 'entry', entryId: 'w_speech1' });
    const list = app.hiddenEntries.list;
    const kept = new Map(records);
    time.advance(MINUTE);

    expect(await app.hide({ kind: 'entry', entryId: 'w_speech1' })).toBeUndefined();

    expect(app.hiddenEntries.list).toBe(list);
    expect(records).toEqual(kept);
  });

  it('changes nothing for an Entry id the Language Pack does not have', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const kept = new Map(records);

    expect(await app.hide({ kind: 'entry', entryId: 'w_gone' })).toBeUndefined();

    expect(app.hiddenEntries.list).toEqual([]);
    expect(records).toEqual(kept);
  });

  it('takes a Category out of the Mix, and its undo puts it back', async () => {
    const app = await run();

    const hidden = await app.hide({ kind: 'category', categoryId: 'speech' });

    expect(hidden?.changed).toEqual({ kind: 'category', categoryId: 'speech' });
    expect(app.mix.state.hiddenCategories).toEqual([speech]);

    await hidden?.undo();

    expect(app.mix.state.hiddenCategories).toEqual([]);
    expect(app.mix.state.categoryIds).toEqual(['nature', 'speech', 'crafts']);
  });

  it('changes nothing for a Category out of the Mix already', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.hide({ kind: 'category', categoryId: 'speech' });
    const state = app.mix.state;
    const kept = new Map(records);

    expect(await app.hide({ kind: 'category', categoryId: 'speech' })).toBeUndefined();

    expect(app.mix.state).toBe(state);
    expect(records).toEqual(kept);
  });

  it('refuses the last Category in the Mix: nothing changed', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.hide({ kind: 'category', categoryId: 'nature' });
    await app.hide({ kind: 'category', categoryId: 'crafts' });
    const state = app.mix.state;
    const kept = new Map(records);

    expect(await app.hide({ kind: 'category', categoryId: 'speech' })).toBeUndefined();

    expect(app.mix.state).toBe(state);
    expect(state.categoryIds).toEqual(['speech']);
    expect(records).toEqual(kept);
  });

  it('changes nothing for a Category the Edition does not have', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const state = app.mix.state;
    const kept = new Map(records);

    expect(await app.hide({ kind: 'category', categoryId: 'gone' })).toBeUndefined();

    expect(app.mix.state).toBe(state);
    expect(records).toEqual(kept);
  });

  it('takes Corrections out of the Mix, and its undo puts them back', async () => {
    const app = await run();

    const hidden = await app.hide({ kind: 'corrections' });

    expect(hidden?.changed).toEqual({ kind: 'corrections' });
    expect(app.mix.state.corrections).toBe(false);

    await hidden?.undo();

    expect(app.mix.state.corrections).toBe(true);
  });

  it('changes nothing for Corrections out of the Mix already', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    await app.hide({ kind: 'corrections' });
    const state = app.mix.state;
    const kept = new Map(records);

    expect(await app.hide({ kind: 'corrections' })).toBeUndefined();

    expect(app.mix.state).toBe(state);
    expect(records).toEqual(kept);
  });
});

describe('two hides at once', () => {
  it.each([
    ['an Entry', { kind: 'entry', entryId: 'w_speech1' }],
    ['a Category', { kind: 'category', categoryId: 'speech' }],
    ['Corrections', { kind: 'corrections' }],
  ] as const)(
    'on %s: one changes it and gives the undo, the other changes nothing',
    async (_, target) => {
      const app = await run();

      const results = await Promise.all([app.hide(target), app.hide(target)]);

      expect(results.filter((result) => result !== undefined)).toHaveLength(1);
      expect(results.find((result) => result !== undefined)?.undo).toBeTypeOf('function');
    },
  );
});

describe('two unhides at once', () => {
  it.each([
    ['an Entry', { kind: 'entry', entryId: 'w_speech1' }],
    ['a Category', { kind: 'category', categoryId: 'speech' }],
    ['Corrections', { kind: 'corrections' }],
  ] as const)('on %s: one changes it, the other changes nothing', async (_, target) => {
    const app = await run();
    await app.hide(target);

    const results = await Promise.all([app.unhide(target), app.unhide(target)]);

    expect(results.filter((result) => result !== undefined)).toHaveLength(1);
  });
});

describe('the undo of a hide', () => {
  it('makes a hidden card come back to the Feed where it was, on screen again', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const before = entryIdsOf(app.feed.cards);
    const onScreen = before[1] ?? '';
    const hidden = await app.hide({ kind: 'entry', entryId: onScreen });
    expect(entryIdsOf(app.feed.cards)).not.toContain(onScreen);

    await hidden?.undo();

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(entryIdOf(app.feed.cards[app.feed.position ?? -1])).toBe(onScreen);
  });

  it('makes the cards of a hidden Category come back to the Feed where they were', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const before = entryIdsOf(app.feed.cards);
    const onScreen = before[1] ?? '';
    const category = categories.find((each) => isWordOf(each)(onScreen)) ?? nature;
    const hidden = await app.hide({ kind: 'category', categoryId: category.id });
    expect(entryIdsOf(app.feed.cards).filter(isWordOf(category))).toEqual([]);

    await hidden?.undo();

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(entryIdOf(app.feed.cards[app.feed.position ?? -1])).toBe(onScreen);
  });

  it('makes the Correction cards come back to the Feed where they were', async () => {
    const app = await run();
    const reader = await run();
    const offered: string[] = [];
    for (let position = 0; !offered.some(isCorrection); position += 1) {
      await reader.feed.show(position);
      offered.push(...entryIdsOf(reader.feed.cards).slice(offered.length));
    }
    const onScreen = offered.findIndex(isCorrection);
    await turnTo(app.feed, onScreen);
    const before = entryIdsOf(app.feed.cards);
    const hidden = await app.hide({ kind: 'corrections' });
    expect(entryIdsOf(app.feed.cards).filter(isCorrection)).toEqual([]);

    await hidden?.undo();

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(app.feed.position).toBe(onScreen);
  });
});

describe('an unhide', () => {
  it('restores a Hidden Entry, gives its row, and its undo hides it again at its old place in the list', async () => {
    const time = fakeClock();
    const app = await run({ clock: time.clock });
    await app.hide({ kind: 'entry', entryId: 'w_nature0' });
    time.advance(MINUTE);
    await app.hide({ kind: 'entry', entryId: 'c_one' });
    time.advance(MINUTE);
    await app.hide({ kind: 'entry', entryId: 'w_crafts2' });
    const before = app.hiddenEntries.list;

    const unhidden = await app.unhide({ kind: 'entry', entryId: 'c_one' });

    expect(unhidden?.changed).toEqual({
      kind: 'entry',
      entryId: 'c_one',
      row: {
        kind: 'correction',
        entryId: 'c_one',
        title: 'one',
        nonStandardForm: 'not one',
        correctionType: 'calque',
      },
    });
    expect(hiddenIdsOf(app)).toEqual(['w_crafts2', 'w_nature0']);

    time.advance(MINUTE);
    await unhidden?.undo?.();

    expect(app.hiddenEntries.list).toEqual(before);
    expect(hiddenIdsOf(app)).toEqual(['w_crafts2', 'c_one', 'w_nature0']);
  });

  it('changes nothing for an Entry that is not Hidden, or an id the Language Pack does not have', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const kept = new Map(records);

    expect(await app.unhide({ kind: 'entry', entryId: 'w_speech1' })).toBeUndefined();
    expect(await app.unhide({ kind: 'entry', entryId: 'w_gone' })).toBeUndefined();

    expect(records).toEqual(kept);
  });

  it('puts a Hidden Category back in the Mix, with no undo', async () => {
    const app = await run();
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    const unhidden = await app.unhide({ kind: 'category', categoryId: 'crafts' });

    expect(unhidden).toEqual({
      changed: { kind: 'category', categoryId: 'crafts' },
      undo: undefined,
    });
    expect(app.mix.state.hiddenCategories).toEqual([]);
  });

  it('changes nothing for a Category in the Mix, or one the Edition does not have', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const kept = new Map(records);

    expect(await app.unhide({ kind: 'category', categoryId: 'crafts' })).toBeUndefined();
    expect(await app.unhide({ kind: 'category', categoryId: 'gone' })).toBeUndefined();

    expect(records).toEqual(kept);
  });

  it('puts Corrections back in the Mix, with no undo', async () => {
    const app = await run();
    await app.hide({ kind: 'corrections' });

    const unhidden = await app.unhide({ kind: 'corrections' });

    expect(unhidden).toEqual({ changed: { kind: 'corrections' }, undo: undefined });
    expect(app.mix.state.corrections).toBe(true);
  });

  it('changes nothing for Corrections in the Mix', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const kept = new Map(records);

    expect(await app.unhide({ kind: 'corrections' })).toBeUndefined();

    expect(records).toEqual(kept);
  });
});
