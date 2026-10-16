import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Category,
  type Clock,
  type Composition,
  type ContentReadPort,
  type Random,
} from './index';

function word(
  id: string,
  categoryId: string,
  { lemma = id.slice(2), stress = [0], retired = false }: Partial<Word> = {},
): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress,
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${lemma}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId,
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
    standardEquivalents: [id.slice(2), `also ${id.slice(2)}`],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

/** The Edition's Categories, in its order. */
const nature: Category = { id: 'nature', displayName: 'Nature' };
const speech: Category = { id: 'speech', displayName: 'Speech' };
const categories = [nature, speech];

/** A small pack: two live Words in each Category, a Retired Word and two live Corrections. */
const words = [
  word('w_nature0', 'nature'),
  word('w_nature1', 'nature'),
  word('w_speech0', 'speech'),
  word('w_speech1', 'speech'),
  word('w_old', 'nature', { retired: true }),
];
const corrections = [correction('c_one'), correction('c_two')];
const pack = createMemoryContentPort({ words, corrections });

/** A clock the test moves by hand. */
function fakeClock(start = '2026-10-16T09:00:00+03:00') {
  let now = new Date(start).getTime();
  const clock: Clock = { now: () => new Date(now), timeZone: () => 'Europe/Kyiv' };
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const MINUTE = 60_000;

/** Any VoiceOver text, for a test about what the widget shows. */
const anyVoiceOver = { voiceOver: expect.any(String) as unknown };

/** A random port that steps through [0, 1), so each new Collection gets its own id. */
function steppingRandom(): Random {
  let step = 0;
  return {
    next() {
      step += 1;
      return (step * 0.6180339887) % 1;
    },
  };
}

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  content = pack,
  clock = fakeClock().clock,
  withCorrections = true,
}: {
  records?: Map<string, string>;
  content?: ContentReadPort;
  clock?: Clock;
  withCorrections?: boolean;
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => withCorrections && feature === 'corrections',
      languageTraits: { distractorRule: 'same-part-of-speech' },
      categories,
      userSettingDefaults: {
        mix: { categoryIds: categories.map(({ id }) => id), corrections: true },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: steppingRandom(),
  });
}

describe('The Widget Snapshot', () => {
  it('shows every Eligible Entry in the mode of all Entries', async () => {
    const app = await run();

    expect((await app.widget.snapshot()).allEntries).toEqual([
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

    const snapshot = await app.widget.snapshot();

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

    const snapshot = await app.widget.snapshot();

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
    await app.hide({ kind: 'corrections' });

    const out = await app.widget.snapshot();
    expect(out.allEntries).toEqual(['w_nature0', 'w_nature1', 'w_speech0', 'w_speech1']);
    expect(out.favorites).toEqual([]);

    await app.unhide({ kind: 'corrections' });
    const back = await app.widget.snapshot();
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

  it('shows the eligible Favorites, newest first', async () => {
    const { clock, advance } = fakeClock();
    const app = await run({ clock });
    for (const id of ['w_nature0', 'c_one', 'w_speech0', 'w_old']) {
      await app.favorites.add(id);
      advance(MINUTE);
    }

    expect((await app.widget.snapshot()).favorites).toEqual(['w_speech0', 'c_one', 'w_nature0']);
  });

  it('drops a Favorite once it is hidden or out of the Mix', async () => {
    const { clock, advance } = fakeClock();
    const app = await run({ clock });
    for (const id of ['w_nature0', 'w_nature1', 'w_speech0']) {
      await app.favorites.add(id);
      advance(MINUTE);
    }
    await app.hide({ kind: 'entry', entryId: 'w_nature1' });
    await app.hide({ kind: 'category', categoryId: 'speech' });

    expect((await app.widget.snapshot()).favorites).toEqual(['w_nature0']);
  });

  it('drops a Favorite once a new Language Pack retires it', async () => {
    const records = new Map<string, string>();
    const first = await run({ records });
    await first.favorites.add('w_nature0');

    const retired = createMemoryContentPort({
      words: words.map((kept) => (kept.id === 'w_nature0' ? { ...kept, retired: true } : kept)),
      corrections,
    });
    const snapshot = await (await run({ records, content: retired })).widget.snapshot();

    expect(snapshot.favorites).toEqual([]);
    expect(snapshot.allEntries).not.toContain('w_nature0');
  });

  it('shows each Collection with its eligible Entries, newest first, empty ones too', async () => {
    const { clock, advance } = fakeClock();
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

    expect((await app.widget.snapshot()).collections).toEqual([
      { id: empty.collection.id, name: 'Empty', entryIds: [] },
      { id: letters.collection.id, name: 'Letters', entryIds: ['c_two', 'w_nature0'] },
    ]);
  });

  it("carries a Collection's new name and leaves out a deleted Collection", async () => {
    const { clock, advance } = fakeClock();
    const app = await run({ clock });
    const renamed = await app.collections.create('Letters', 'w_nature0');
    advance(MINUTE);
    const deleted = await app.collections.create('Gone', 'w_nature1');
    if (!renamed.ok || !deleted.ok) throw new Error('The Collections were not created');

    await app.collections.rename(renamed.collection.id, 'For letters');
    await app.collections.delete(deleted.collection.id);

    expect((await app.widget.snapshot()).collections).toEqual([
      { id: renamed.collection.id, name: 'For letters', entryIds: ['w_nature0'] },
    ]);
  });

  it('heads a Word with its Lemma and every valid Stress mark over its primary Definition', async () => {
    const app = await run({
      content: createMemoryContentPort({
        words: [
          word('w_veremiia', 'nature', { lemma: 'веремія', stress: [5] }),
          word('w_zavzhdy', 'nature', { lemma: 'завжди', stress: [1, 5] }),
        ],
      }),
    });

    expect((await app.widget.snapshot()).entries).toMatchObject([
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
            ...word('w_khymernyk', 'nature', { lemma: 'химерник', stress: [3] }),
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

    expect((await app.widget.snapshot()).entries.map(({ voiceOver }) => voiceOver)).toEqual([
      'химерник, Людина, схильна до витівок.',
      'протягом року, на протязі року',
    ]);
  });

  it('heads a Correction with its main standard equivalent over the form it replaces', async () => {
    const app = await run({
      content: createMemoryContentPort({
        words: [word('w_nature0', 'nature')],
        corrections: [
          {
            ...correction('c_protiahom'),
            nonStandardForm: 'на протязі року',
            standardEquivalents: ['протягом року', 'упродовж року'],
          },
        ],
      }),
    });

    expect((await app.widget.snapshot()).entries).toContainEqual({
      ...anyVoiceOver,
      kind: 'correction',
      id: 'c_protiahom',
      headline: 'протягом року',
      secondLine: 'на протязі року',
    });
  });

  it('names the Edition and the time it was built, and tells whether the onboarding is finished', async () => {
    const { clock, advance } = fakeClock('2026-10-16T09:00:00+03:00');
    const app = await run({ clock });

    expect(await app.widget.snapshot()).toMatchObject({
      format: 1,
      editionId: 'test',
      writtenAt: '2026-10-16T06:00:00.000Z',
      onboardingFinished: false,
    });

    await app.onboarding.finish();
    advance(MINUTE);
    expect(await app.widget.snapshot()).toMatchObject({
      writtenAt: '2026-10-16T06:01:00.000Z',
      onboardingFinished: true,
    });
  });
});
