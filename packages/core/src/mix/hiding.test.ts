import { describe, expect, it } from 'vitest';

import { openComposition, type Clock, type Composition, type Feed, type FeedCard } from '../index';
import { MIX_KINDS } from '../entries/entry-kinds';
import { createMemoryContentPort } from '../testing';
import type { Category } from '@slovo/contracts';
import { correction, fakeClock, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

/** The Language Pack's Categories, in its order. */
const nature: Category = {
  id: 'nature',
  displayName: 'Nature',
  description: 'Nature.',
  tone: 'loud',
};
const speech: Category = {
  id: 'speech',
  displayName: 'Speech',
  description: 'Speech.',
  tone: 'loud',
};
const crafts: Category = {
  id: 'crafts',
  displayName: 'Crafts',
  description: 'Crafts.',
  tone: 'loud',
};
const categories = [nature, speech, crafts];

/** A small pack: three live Words in each Category, and two live Corrections. */
const wordIdsOf = (category: Category) =>
  [0, 1, 2].map((index) => `w_${category.id}${String(index)}`);
const content = createMemoryContentPort({
  categories,
  words: categories.flatMap((category) =>
    wordIdsOf(category).map((id) => word(id, { categoryId: category.id })),
  ),
  corrections: ['c_one', 'c_two'].map((id) => correction(id)),
});

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
    edition: testEdition({
      isFeatureEnabled: (feature) => feature === 'corrections',
      userSettingDefaults: { mix: { categoryIds: categories.map(({ id }) => id) } },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
}

/** The ids of the Entries the cards show, in order. */
const entryIdsOf = (cards: readonly FeedCard[]) => cards.flatMap((card) => card.entryId ?? []);

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

    await hidden?.undo(app);

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

    await hidden?.undo(app);

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

  it.each(MIX_KINDS)(
    'takes the kind %s as a whole out of the Mix, and its undo puts it back',
    async (entryKind) => {
      const app = await run();

      const hidden = await app.hide({ kind: 'whole-kind', entryKind });

      expect(hidden?.changed).toEqual({ kind: 'whole-kind', entryKind });
      expect(app.mix.state.kinds[entryKind]).toBe(false);

      await hidden?.undo(app);

      expect(app.mix.state.kinds[entryKind]).toBe(true);
    },
  );

  it.each(MIX_KINDS)(
    'changes nothing for the kind %s out of the Mix already',
    async (entryKind) => {
      const records = new Map<string, string>();
      const app = await run({ records });
      await app.hide({ kind: 'whole-kind', entryKind });
      const state = app.mix.state;
      const kept = new Map(records);

      expect(await app.hide({ kind: 'whole-kind', entryKind })).toBeUndefined();

      expect(app.mix.state).toBe(state);
      expect(records).toEqual(kept);
    },
  );
});

describe('a hide whose following of eligibility fails', () => {
  /**
   * The composition with its Feed shown, over a pack whose Entries fail to
   * read once a change is written while `failing.on`, and the errors it reports.
   */
  async function failingRun() {
    const failing = { on: false };
    let written = false;
    const reported: unknown[] = [];
    const port = createMemoryUserStatePort();
    const app = await openComposition({
      content: {
        ...content,
        getEntries: (ids) =>
          written ? Promise.reject(new Error('The pack is busy')) : content.getEntries(ids),
      },
      edition: testEdition({
        isFeatureEnabled: (feature) => feature === 'corrections',
        userSettingDefaults: { mix: { categoryIds: categories.map(({ id }) => id) } },
      }),
      userState: await openUserState({
        port: {
          ...port,
          write: async (changes) => {
            await port.write(changes);
            written = failing.on;
          },
        },
      }),
      clock: fakeClock().clock,
      random: { next: () => 0.25 },
      reportError: (error) => reported.push(error),
    });
    await turnTo(app.feed, 0);
    return {
      app,
      failing,
      reported,
      /** Stops failing, as the next read of the pack would succeed. */
      recover: () => {
        failing.on = false;
        written = false;
      },
    };
  }

  it('hides the Entry, gives its undo and reports the error', async () => {
    const { app, failing, reported, recover } = await failingRun();
    const [entryId = ''] = entryIdsOf(app.feed.cards);
    failing.on = true;

    const hidden = await app.hide({ kind: 'entry', entryId });

    expect(hidden?.changed.kind).toBe('entry');
    expect(app.hiddenEntries.has(entryId)).toBe(true);
    expect(reported).toEqual([new Error('The pack is busy')]);
    recover();
    await hidden?.undo(app);
    expect(app.hiddenEntries.has(entryId)).toBe(false);
  });

  it('takes the Category out, gives its undo and reports the error', async () => {
    const { app, failing, reported } = await failingRun();
    const [entryId = ''] = entryIdsOf(app.feed.cards);
    const shown = categories.find((category) => isWordOf(category)(entryId));
    failing.on = true;

    const hidden = await app.hide({ kind: 'category', categoryId: shown?.id ?? '' });

    expect(hidden?.changed.kind).toBe('category');
    expect(app.mix.state.hiddenCategories).toEqual([shown]);
    expect(reported).toEqual([new Error('The pack is busy')]);
  });

  it('lets the Mix take a Category out and say so, reporting the error', async () => {
    const { app, failing, reported } = await failingRun();
    failing.on = true;

    expect(await app.mix.takeOut('nature')).toBe(true);

    expect(app.mix.state.hiddenCategories).toEqual([nature]);
    expect(reported).toEqual([new Error('The pack is busy')]);
  });
});

describe('two hides at once', () => {
  it.each([
    ['an Entry', { kind: 'entry', entryId: 'w_speech1' }],
    ['a Category', { kind: 'category', categoryId: 'speech' }],
    ['Corrections', { kind: 'whole-kind', entryKind: 'correction' }],
    ['Idioms', { kind: 'whole-kind', entryKind: 'idiom' }],
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
    ['Corrections', { kind: 'whole-kind', entryKind: 'correction' }],
    ['Idioms', { kind: 'whole-kind', entryKind: 'idiom' }],
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

    await hidden?.undo(app);

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(app.feed.cards[app.feed.position]?.entryId).toBe(onScreen);
  });

  it('makes the cards of a hidden Category come back to the Feed where they were', async () => {
    const app = await run();
    await turnTo(app.feed, 1);
    const before = entryIdsOf(app.feed.cards);
    const onScreen = before[1] ?? '';
    const category = categories.find((each) => isWordOf(each)(onScreen)) ?? nature;
    const hidden = await app.hide({ kind: 'category', categoryId: category.id });
    expect(entryIdsOf(app.feed.cards).filter(isWordOf(category))).toEqual([]);

    await hidden?.undo(app);

    expect(entryIdsOf(app.feed.cards).slice(0, before.length)).toEqual(before);
    expect(app.feed.cards[app.feed.position]?.entryId).toBe(onScreen);
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
    const hidden = await app.hide({ kind: 'whole-kind', entryKind: 'correction' });
    expect(entryIdsOf(app.feed.cards).filter(isCorrection)).toEqual([]);

    await hidden?.undo(app);

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
        secondLine: 'not one',
        labelKey: 'correction',
        spoken: 'one, not one',
        correctionType: 'calque',
        standardForms: ['one', 'also one'],
      },
    });
    expect(hiddenIdsOf(app)).toEqual(['w_crafts2', 'w_nature0']);

    time.advance(MINUTE);
    await unhidden?.undo(app);

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

  it('puts a Hidden Category back in the Mix, and its undo takes it out again', async () => {
    const app = await run();
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    const unhidden = await app.unhide({ kind: 'category', categoryId: 'crafts' });

    expect(unhidden?.changed).toEqual({ kind: 'category', categoryId: 'crafts' });
    expect(app.mix.state.hiddenCategories).toEqual([]);

    await unhidden?.undo(app);

    expect(app.mix.state.hiddenCategories).toEqual([crafts]);
  });

  it('changes nothing for a Category in the Mix, or one the Edition does not have', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const kept = new Map(records);

    expect(await app.unhide({ kind: 'category', categoryId: 'crafts' })).toBeUndefined();
    expect(await app.unhide({ kind: 'category', categoryId: 'gone' })).toBeUndefined();

    expect(records).toEqual(kept);
  });

  it('changes nothing for a Category in the Mix while another one is Hidden', async () => {
    const app = await run();
    await app.hide({ kind: 'category', categoryId: 'crafts' });

    expect(await app.unhide({ kind: 'category', categoryId: 'speech' })).toBeUndefined();
    expect(app.mix.state.hiddenCategories).toEqual([crafts]);
  });

  it.each(MIX_KINDS)(
    'puts the kind %s as a whole back in the Mix, and its undo takes it out again',
    async (entryKind) => {
      const app = await run();
      await app.hide({ kind: 'whole-kind', entryKind });

      const unhidden = await app.unhide({ kind: 'whole-kind', entryKind });

      expect(unhidden?.changed).toEqual({ kind: 'whole-kind', entryKind });
      expect(app.mix.state.kinds[entryKind]).toBe(true);

      await unhidden?.undo(app);

      expect(app.mix.state.kinds[entryKind]).toBe(false);
    },
  );

  it.each(MIX_KINDS)('changes nothing for the kind %s in the Mix', async (entryKind) => {
    const records = new Map<string, string>();
    const app = await run({ records });
    const kept = new Map(records);

    expect(await app.unhide({ kind: 'whole-kind', entryKind })).toBeUndefined();

    expect(records).toEqual(kept);
  });
});
