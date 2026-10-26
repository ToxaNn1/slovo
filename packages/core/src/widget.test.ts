import {
  WidgetSnapshotSchema,
  type Category,
  type SynonymRow,
  type Tip,
  type WidgetSnapshot,
} from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type ContentReadPort,
} from './index';
import { createMemoryContentPort } from './testing';
import { correction, fakeClock, idiom, steppingRandom, word } from './test-support';

/** The instant these tests start at. */
const start = '2026-10-16T09:00:00+03:00';

/** The Language Pack's Categories, in its order. */
const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const categories = [nature, speech];

/** A small pack: two live Words in each Category, a Retired Word and two live Corrections. */
const words = [
  word('w_nature0', { categoryId: 'nature' }),
  word('w_nature1', { categoryId: 'nature' }),
  word('w_speech0', { categoryId: 'speech' }),
  word('w_speech1', { categoryId: 'speech' }),
  word('w_old', { categoryId: 'nature', retired: true }),
];
const corrections = [correction('c_one'), correction('c_two')];
const pack = createMemoryContentPort({ categories, words, corrections });
/** The same pack with two live Idioms. */
const withIdiomsPack = createMemoryContentPort({
  categories,
  words,
  corrections,
  idioms: [idiom('i_one'), idiom('i_two')],
});

/** A live Synonym Row of «іти» with five members, each with its Stress. */
const ityRow: SynonymRow = {
  kind: 'synonymRow',
  id: 'r_ity',
  dominant: { text: 'іти', stress: [2] },
  meaning: 'Рухатися пішки.',
  members: [
    { text: 'простувати', stress: [7] },
    { text: 'чимчикувати', stress: [4] },
    { text: 'шкандибати', stress: [7] },
    { text: 'дибати', stress: [1] },
    { text: 'чалапати', stress: [3] },
  ],
  sources: [{ title: 'Test source' }],
  retired: false,
};

/** A live Tip on asking the time. */
const timeTip: Tip = {
  kind: 'tip',
  id: 't_kotrahodyna',
  title: 'Котра година?',
  nonStandardForm: 'Скільки час?',
  standardForm: 'Котра година?',
  explanation: 'Про час питають «котра година».',
  sources: [{ title: 'Test source' }],
  gameQuestion: {
    prompt: 'Як запитати про час?',
    rightAnswer: 'Котра година?',
    wrongAnswers: ['Скільки час?', 'Скільки годин?', 'Який час?'],
  },
  retired: false,
};

/** The same pack with a live and a Retired Synonym Row, and a live and a Retired Tip. */
const withRowsAndTipsPack = createMemoryContentPort({
  categories,
  words,
  corrections,
  idioms: [idiom('i_one')],
  synonymRows: [ityRow, { ...ityRow, id: 'r_old', retired: true }],
  tips: [timeTip, { ...timeTip, id: 't_old', retired: true }],
});

/** The Edition's words the widget writes a row's and a Tip's second line with. */
const strings = { ellipsis: '…', tipStandardForm: 'Так: {form}' };

const MINUTE = 60_000;

/** Any VoiceOver text, for a test about what the widget shows. */
const anyVoiceOver = { voiceOver: expect.any(String) as unknown };

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  content = pack,
  clock = fakeClock(start).clock,
  withCorrections = true,
  withIdioms = true,
  withRowsAndTips = true,
  withWidget = true,
}: {
  records?: Map<string, string>;
  content?: ContentReadPort;
  clock?: Clock;
  withCorrections?: boolean;
  withIdioms?: boolean;
  /** Whether the Feature Switches of Synonym Rows and Tips are on. */
  withRowsAndTips?: boolean;
  /** Whether the Feature Switch of the widget is on, as the Edition in effect has it. */
  withWidget?: boolean;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) =>
        feature === 'widget'
          ? withWidget
          : (withCorrections && feature === 'corrections') ||
            (withIdioms && feature === 'idioms') ||
            (withRowsAndTips && (feature === 'synonymRows' || feature === 'tips')),
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

/** The Widget Snapshot of an app whose widget is on; it fails the test when there is none. */
async function snapshotOf(app: Composition): Promise<WidgetSnapshot> {
  const snapshot = await app.widget.snapshot(strings);
  if (snapshot === undefined) throw new Error('No Widget Snapshot was built');
  return snapshot;
}

describe('The Widget Snapshot', () => {
  it('builds none while the widget is switched off, and builds one again once it is on', async () => {
    const off = await run({ withWidget: false });
    const on = await run();

    expect(await off.widget.snapshot(strings)).toBeUndefined();
    expect((await snapshotOf(on)).allEntries).toHaveLength(6);
  });

  it('shows every Eligible Entry in the mode of all Entries', async () => {
    const app = await run();

    expect((await snapshotOf(app)).allEntries).toEqual([
      'w_nature0',
      'w_nature1',
      'w_speech0',
      'w_speech1',
      'c_one',
      'c_two',
    ]);
  });

  it('leaves Hidden Entries, Hidden Categories and Retired Words out of every mode', async () => {
    const app = await run();
    const kept = ['w_nature0', 'w_nature1', 'w_speech0', 'w_old'];
    const letters = await app.collections.create('Letters');
    if (!letters.ok) throw new Error('The Collection was not created');
    for (const id of kept) {
      await app.favorites.add(id);
      await app.collections.add(letters.collection.id, id);
    }
    await app.hide({ kind: 'entry', entryId: 'w_nature1' });
    await app.hide({ kind: 'category', categoryId: 'speech' });

    const snapshot = await snapshotOf(app);

    expect(snapshot.allEntries).toEqual(['w_nature0', 'c_one', 'c_two']);
    expect(snapshot.entries.map(({ id }) => id)).toEqual(['w_nature0', 'c_one', 'c_two']);
    expect(snapshot.favorites).toEqual(['w_nature0']);
    expect(snapshot.collections.map(({ entryIds }) => entryIds)).toEqual([['w_nature0']]);
  });

  it('leaves out Corrections when the Edition turns them off, even ones the user keeps', async () => {
    const app = await run({ withCorrections: false });
    await app.favorites.add('c_one');
    const created = await app.collections.create('Phrases', 'c_one');
    if (!created.ok) throw new Error('The Collection was not created');

    const snapshot = await snapshotOf(app);

    expect(snapshot.allEntries).toEqual(['w_nature0', 'w_nature1', 'w_speech0', 'w_speech1']);
    expect(snapshot.favorites).toEqual([]);
    expect(snapshot.collections).toEqual([
      { id: created.collection.id, name: 'Phrases', entryIds: [] },
    ]);
    expect(snapshot.entries.map(({ kind }) => kind)).not.toContain('correction');
  });

  it('shows Corrections only while they are in the Mix', async () => {
    const app = await run();
    await app.favorites.add('c_one');
    await app.hide({ kind: 'whole-kind', entryKind: 'correction' });

    const out = await snapshotOf(app);
    expect(out.allEntries).toEqual(['w_nature0', 'w_nature1', 'w_speech0', 'w_speech1']);
    expect(out.favorites).toEqual([]);

    await app.unhide({ kind: 'whole-kind', entryKind: 'correction' });
    const back = await snapshotOf(app);
    expect(back.allEntries).toEqual([
      'w_nature0',
      'w_nature1',
      'w_speech0',
      'w_speech1',
      'c_one',
      'c_two',
    ]);
    expect(back.favorites).toEqual(['c_one']);
  });

  it('leaves out Idioms when the Edition turns them off, even ones the user keeps', async () => {
    const app = await run({ content: withIdiomsPack, withIdioms: false });
    await app.favorites.add('i_one');
    const created = await app.collections.create('Sayings', 'i_one');
    if (!created.ok) throw new Error('The Collection was not created');

    const snapshot = await snapshotOf(app);

    expect(snapshot.allEntries).toEqual([
      'w_nature0',
      'w_nature1',
      'w_speech0',
      'w_speech1',
      'c_one',
      'c_two',
    ]);
    expect(snapshot.favorites).toEqual([]);
    expect(snapshot.collections).toEqual([
      { id: created.collection.id, name: 'Sayings', entryIds: [] },
    ]);
    expect(snapshot.entries.map(({ kind }) => kind)).not.toContain('idiom');
  });

  it('shows Idioms only while they are in the Mix', async () => {
    const app = await run({ content: withIdiomsPack });
    await app.favorites.add('i_one');
    await app.hide({ kind: 'whole-kind', entryKind: 'idiom' });

    const out = await snapshotOf(app);
    expect(out.allEntries).toEqual([
      'w_nature0',
      'w_nature1',
      'w_speech0',
      'w_speech1',
      'c_one',
      'c_two',
    ]);
    expect(out.favorites).toEqual([]);
    expect(out.entries.map(({ kind }) => kind)).not.toContain('idiom');

    await app.unhide({ kind: 'whole-kind', entryKind: 'idiom' });
    const back = await snapshotOf(app);
    expect(back.allEntries).toEqual([
      'w_nature0',
      'w_nature1',
      'w_speech0',
      'w_speech1',
      'c_one',
      'c_two',
      'i_one',
      'i_two',
    ]);
    expect(back.favorites).toEqual(['i_one']);
  });

  it('shows the eligible Favorites, newest first', async () => {
    const { clock, advance } = fakeClock(start);
    const app = await run({ clock });
    for (const id of ['w_nature0', 'c_one', 'w_speech0', 'w_old']) {
      await app.favorites.add(id);
      advance(MINUTE);
    }

    expect((await snapshotOf(app)).favorites).toEqual(['w_speech0', 'c_one', 'w_nature0']);
  });

  it('drops a Favorite once it is hidden or out of the Mix', async () => {
    const { clock, advance } = fakeClock(start);
    const app = await run({ clock });
    for (const id of ['w_nature0', 'w_nature1', 'w_speech0']) {
      await app.favorites.add(id);
      advance(MINUTE);
    }
    await app.hide({ kind: 'entry', entryId: 'w_nature1' });
    await app.hide({ kind: 'category', categoryId: 'speech' });

    expect((await snapshotOf(app)).favorites).toEqual(['w_nature0']);
  });

  it('drops a Favorite once a new Language Pack retires it', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.favorites.add('w_nature0');

    const retired = createMemoryContentPort({
      words: words.map((kept) => (kept.id === 'w_nature0' ? { ...kept, retired: true } : kept)),
      corrections,
    });
    const snapshot = await snapshotOf(await run({ records, content: retired }));

    expect(snapshot.favorites).toEqual([]);
    expect(snapshot.allEntries).not.toContain('w_nature0');
  });

  it('shows each Collection with its eligible Entries, newest first, empty ones too', async () => {
    const { clock, advance } = fakeClock(start);
    const app = await run({ clock });
    const letters = await app.collections.create('Letters');
    advance(MINUTE);
    const empty = await app.collections.create('Empty');
    if (!letters.ok || !empty.ok) throw new Error('The Collections were not created');
    for (const id of ['w_nature0', 'w_old', 'c_two', 'w_speech1']) {
      advance(MINUTE);
      await app.collections.add(letters.collection.id, id);
    }
    await app.hide({ kind: 'entry', entryId: 'w_speech1' });

    expect((await snapshotOf(app)).collections).toEqual([
      { id: empty.collection.id, name: 'Empty', entryIds: [] },
      { id: letters.collection.id, name: 'Letters', entryIds: ['c_two', 'w_nature0'] },
    ]);
  });

  it("carries a Collection's new name and leaves out a deleted Collection", async () => {
    const { clock, advance } = fakeClock(start);
    const app = await run({ clock });
    const renamed = await app.collections.create('Letters', 'w_nature0');
    advance(MINUTE);
    const deleted = await app.collections.create('Gone', 'w_nature1');
    if (!renamed.ok || !deleted.ok) throw new Error('The Collections were not created');

    await app.collections.rename(renamed.collection.id, 'For letters');
    await app.collections.delete(deleted.collection.id);

    expect((await snapshotOf(app)).collections).toEqual([
      { id: renamed.collection.id, name: 'For letters', entryIds: ['w_nature0'] },
    ]);
  });

  it('heads a Word with its Lemma and every valid Stress mark over its primary Definition', async () => {
    const app = await run({
      content: createMemoryContentPort({
        words: [
          word('w_veremiia', { categoryId: 'nature', lemma: 'веремія', stress: [5] }),
          word('w_zavzhdy', { categoryId: 'nature', lemma: 'завжди', stress: [1, 5] }),
        ],
      }),
    });

    expect((await snapshotOf(app)).entries).toMatchObject([
      {
        kind: 'word',
        id: 'w_veremiia',
        headline: 'веремі\u0301я',
        secondLine: 'The meaning of веремія.',
      },
      {
        kind: 'word',
        id: 'w_zavzhdy',
        headline: 'за\u0301вжди\u0301',
        secondLine: 'The meaning of завжди.',
      },
    ]);
  });

  it('gives VoiceOver the headline and the second line in whole words, with no Stress mark', async () => {
    const app = await run({
      content: createMemoryContentPort({
        words: [
          {
            ...word('w_khymernyk', { categoryId: 'nature', lemma: 'химерник', stress: [3] }),
            primaryDefinition: 'Людина, схильна до витіво\u0301к.',
          },
        ],
        corrections: [
          {
            ...correction('c_protiahom'),
            nonStandardForm: 'на протязі року',
            standardEquivalents: ['протягом року'],
          },
        ],
      }),
    });

    expect((await snapshotOf(app)).entries.map(({ voiceOver }) => voiceOver)).toEqual([
      'химерник, Людина, схильна до витівок.',
      'протягом року, на протязі року',
    ]);
  });

  it('heads a Correction with its main standard equivalent over the form it replaces', async () => {
    const app = await run({
      content: createMemoryContentPort({
        words: [word('w_nature0', { categoryId: 'nature' })],
        corrections: [
          {
            ...correction('c_protiahom'),
            nonStandardForm: 'на протязі року',
            standardEquivalents: ['протягом року', 'упродовж року'],
          },
        ],
      }),
    });

    expect((await snapshotOf(app)).entries).toContainEqual({
      ...anyVoiceOver,
      kind: 'correction',
      id: 'c_protiahom',
      headline: 'протягом року',
      secondLine: 'на протязі року',
    });
  });

  it('shows the live Synonym Rows and Tips after the other kinds in the mode of all Entries', async () => {
    const app = await run({ content: withRowsAndTipsPack });

    const snapshot = await snapshotOf(app);

    expect(snapshot.allEntries).toEqual([
      'w_nature0',
      'w_nature1',
      'w_speech0',
      'w_speech1',
      'c_one',
      'c_two',
      'i_one',
      'r_ity',
      't_kotrahodyna',
    ]);
    expect(WidgetSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('heads a Synonym Row with its dominant over its first 3 members, and a Tip with its title over «Так: …»', async () => {
    const app = await run({ content: withRowsAndTipsPack });

    const { entries } = await snapshotOf(app);

    expect(entries.filter(({ kind }) => kind === 'synonymRow' || kind === 'tip')).toEqual([
      {
        kind: 'synonymRow',
        id: 'r_ity',
        headline: 'іти\u0301',
        secondLine: 'простува\u0301ти, чимчи\u0301кувати, шкандиба\u0301ти…',
        voiceOver: 'іти, простувати, чимчикувати, шкандибати…',
      },
      {
        kind: 'tip',
        id: 't_kotrahodyna',
        headline: 'Котра година?',
        secondLine: 'Так: Котра година?',
        voiceOver: 'Котра година?, Так: Котра година?',
      },
    ]);
  });

  it('leaves out Synonym Rows and Tips when the Edition turns them off, or once they are out of the Mix', async () => {
    const off = await run({ content: withRowsAndTipsPack, withRowsAndTips: false });
    const app = await run({ content: withRowsAndTipsPack });
    await app.mix.setKind('synonymRow', false);
    await app.mix.setKind('tip', false);

    for (const snapshot of [await snapshotOf(off), await snapshotOf(app)]) {
      expect(snapshot.allEntries).toEqual([
        'w_nature0',
        'w_nature1',
        'w_speech0',
        'w_speech1',
        'c_one',
        'c_two',
        'i_one',
      ]);
      expect(snapshot.entries.map(({ id }) => id)).toEqual(snapshot.allEntries);
    }
  });

  it('names the Edition and the time it was built, and tells whether the onboarding is finished', async () => {
    const { clock, advance } = fakeClock('2026-10-16T09:00:00+03:00');
    const app = await run({ clock });

    expect(await snapshotOf(app)).toMatchObject({
      format: 1,
      editionId: 'test',
      writtenAt: '2026-10-16T06:00:00.000Z',
      onboardingFinished: false,
    });

    await app.onboarding.finish();
    advance(MINUTE);
    expect(await snapshotOf(app)).toMatchObject({
      writtenAt: '2026-10-16T06:01:00.000Z',
      onboardingFinished: true,
    });
  });
});
