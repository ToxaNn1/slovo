import { describe, expect, it } from 'vitest';

import type { Correction, FeatureSwitch, SynonymRow, Tip, Word } from '@slovo/contracts';

import {
  createEntries,
  createMemoryUserStatePort,
  openRemoteSwitches,
  openUserState,
} from '../index';
import { createFakeBackend, createMemoryContentPort } from '../testing';
import { countingReads, idiom, randomOf, testEdition } from '../test-support';

function word(id: string, overrides: Partial<Word> = {}): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'adjective',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'speech',
    rarity: 1,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
    ...overrides,
  };
}

function correction(id: string, retired = false): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: `not ${id.slice(2)}`,
    correctionType: 'surzhyk',
    standardEquivalents: [id.slice(2)],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    categoryId: 'everyday',
    sources: [{ title: 'Test source' }],
    literaryUses: [],
    retired,
  };
}

const always = correction('c_always');
const chatty = correction('c_chatty');
const corrections = [always, chatty, correction('c_old', true)];
const talkative = word('w_talkative', {
  correctionIds: ['c_chatty', 'c_old', 'c_missing', 'c_always'],
});
const gone = word('w_gone', { correctionIds: ['c_always'], retired: true });
const words = [
  word('w_always', { correctionIds: ['c_always'] }),
  talkative,
  gone,
  word('w_plain', { categoryId: 'nature' }),
];

const idioms = [
  idiom('i_lazy'),
  idiom('i_place', { idiomType: 'placeName' }),
  idiom('i_old', { retired: true }),
];

function synonymRow(id: string, retired = false): SynonymRow {
  return {
    kind: 'synonymRow',
    id,
    dominant: { text: 'іти', stress: [2] },
    meaning: 'Рухатися пішки.',
    members: ['простувати', 'чимчикувати', 'шкандибати', 'дибати', 'чалапати'].map((text) => ({
      text,
      stress: [0],
    })),
    sources: [{ title: 'Test source' }],
    retired,
  };
}

function tip(id: string, retired = false): Tip {
  return {
    kind: 'tip',
    id,
    title: 'A rule.',
    standardForm: 'Better say this.',
    explanation: 'An explanation.',
    sources: [{ title: 'Test source' }],
    gameQuestion: { prompt: 'Which one?', rightAnswer: 'This', wrongAnswers: ['A', 'B', 'C'] },
    retired,
  };
}

const synonymRows = [synonymRow('r_walk'), synonymRow('r_old', true)];
const tips = [tip('t_comma'), tip('t_old', true)];

/** The Language Pack's Categories, in its order. */
const categories = [
  { id: 'speech', displayName: 'Speech' },
  { id: 'nature', displayName: 'Nature' },
];

/**
 * An Edition with the Corrections and Idioms Feature Switches on or off, and
 * those of Synonym Rows and Tips on unless `off` names them; `speech` and
 * `nature`, and every kind as a whole, in its default Mix.
 */
/** A backend that answers nothing, as when offline. */
function unreachableBackend() {
  const backend = createFakeBackend();
  backend.online = false;
  return backend.backend;
}

const editionWith = (corrections: boolean, idioms = true, off: readonly FeatureSwitch[] = []) =>
  testEdition({
    isFeatureEnabled: (feature) =>
      !off.includes(feature) &&
      ((feature === 'corrections' && corrections) ||
        (feature === 'idioms' && idioms) ||
        feature === 'synonymRows' ||
        feature === 'tips'),
    userSettingDefaults: { mix: { categoryIds: ['speech', 'nature'] } },
  });

const openContent = () =>
  createMemoryContentPort({ categories, words, corrections, idioms, synonymRows, tips });

const open = ({ correctionsSwitch = true, idiomsSwitch = true } = {}) =>
  createEntries({
    content: openContent(),
    edition: editionWith(correctionsSwitch, idiomsSwitch),
  });

/** The Entries over the user state's records, written as the user state keeps them. */
async function openOver(records: Record<string, unknown>, edition = editionWith(true)) {
  const port = createMemoryUserStatePort();
  await port.write(
    new Map(Object.entries(records).map(([key, value]) => [key, JSON.stringify(value)])),
  );
  return {
    port,
    entries: createEntries({
      content: openContent(),
      edition,
      userState: await openUserState({ port }),
    }),
  };
}

const ids = (entries: readonly { id: string }[]) => entries.map(({ id }) => id);

describe('the Entries', () => {
  describe('eligible', () => {
    it('are the live Words, Corrections, Idioms, Synonym Rows and Tips, each kind in the Language Pack order', async () => {
      expect(await open().eligible()).toEqual({
        words: ['w_always', 'w_talkative', 'w_plain'],
        corrections: ['c_always', 'c_chatty'],
        idioms: ['i_lazy', 'i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
    });

    it('hold no Correction when the Edition turns Corrections off', async () => {
      expect(await open({ correctionsSwitch: false }).eligible()).toEqual({
        words: ['w_always', 'w_talkative', 'w_plain'],
        corrections: [],
        idioms: ['i_lazy', 'i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
    });

    it('hold no Idiom when the Edition turns Idioms off', async () => {
      const entries = open({ idiomsSwitch: false });

      expect((await entries.eligible()).idioms).toEqual([]);
      expect(await entries.eligibleOfKind('idiom')).toEqual({ entries: [] });
    });

    it('hold no Idiom when Idioms are turned off remotely, by the answer the device kept', async () => {
      const port = createMemoryUserStatePort();
      const userState = await openUserState({ port });
      await port.write(
        new Map([['edition.switches', JSON.stringify({ off: ['idioms'], etag: '"idioms"' })]]),
      );
      const remote = await openRemoteSwitches({
        edition: editionWith(true),
        backend: unreachableBackend(),
        userState,
        schedule: (run) => {
          run();
          return () => undefined;
        },
        random: randomOf(0),
      });
      const entries = createEntries({ content: openContent(), edition: remote.edition, userState });

      expect((await entries.eligible()).idioms).toEqual([]);
      expect(await entries.eligibleOfKind('idiom')).toEqual({ entries: [] });
    });

    it('leave out every Hidden Entry, read afresh on every call', async () => {
      const port = createMemoryUserStatePort();
      const entries = createEntries({
        content: openContent(),
        edition: editionWith(true),
        userState: await openUserState({ port }),
      });
      await port.write(
        new Map([
          ['hidden.w_talkative', JSON.stringify('2026-10-11T06:00:00.000Z')],
          ['hidden.c_chatty', JSON.stringify('2026-10-11T06:00:00.000Z')],
          ['hidden.i_lazy', JSON.stringify('2026-10-11T06:00:00.000Z')],
        ]),
      );

      expect(await entries.eligible()).toEqual({
        words: ['w_always', 'w_plain'],
        corrections: ['c_always'],
        idioms: ['i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
      expect(await entries.eligibleOfKind('idiom')).toEqual({ entries: [idioms[1]] });

      await port.write(new Map([['hidden.w_talkative', undefined]]));

      expect(await entries.eligible()).toEqual({
        words: ['w_always', 'w_talkative', 'w_plain'],
        corrections: ['c_always'],
        idioms: ['i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
    });

    it('are only the Words of the Categories in the Mix, Category by Category in the Language Pack order, and Corrections only while in the Mix', async () => {
      const port = createMemoryUserStatePort();
      const asked: (string | undefined)[] = [];
      const content = createMemoryContentPort({
        categories: [
          { id: 'nature', displayName: 'Nature' },
          { id: 'speech', displayName: 'Speech' },
          { id: 'crafts', displayName: 'Crafts' },
        ],
        words,
        corrections,
        idioms,
        synonymRows,
        tips,
      });
      const entries = createEntries({
        content: {
          ...content,
          listWordIds(categoryId) {
            asked.push(categoryId);
            return content.listWordIds(categoryId);
          },
        },
        edition: editionWith(true),
        userState: await openUserState({ port }),
      });

      expect(await entries.eligible()).toEqual({
        words: ['w_plain', 'w_always', 'w_talkative'],
        corrections: ['c_always', 'c_chatty'],
        idioms: ['i_lazy', 'i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
      expect(asked).toEqual(['nature', 'speech']);

      await port.write(
        new Map([
          ['mix.categories.nature', JSON.stringify(false)],
          ['mix.corrections', JSON.stringify(false)],
        ]),
      );

      expect(await entries.eligible()).toEqual({
        words: ['w_always', 'w_talkative'],
        corrections: [],
        idioms: ['i_lazy', 'i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
    });

    it('hold the Idioms only while they are in the Mix, and say when they are out', async () => {
      const { port, entries } = await openOver({ 'mix.idioms': false });

      expect((await entries.eligible()).idioms).toEqual([]);
      expect(await entries.eligibleOfKind('idiom')).toEqual({ refusal: 'idioms-out-of-mix' });

      await port.write(new Map([['mix.idioms', JSON.stringify(true)]]));

      expect((await entries.eligible()).idioms).toEqual(['i_lazy', 'i_place']);
      expect(await entries.eligibleOfKind('idiom')).toEqual({ entries: idioms.slice(0, 2) });
    });

    it('say that Idioms are out of the Mix whether or not the Edition turns them on', async () => {
      const { entries } = await openOver({ 'mix.idioms': false }, editionWith(true, false));

      expect(await entries.eligibleOfKind('idiom')).toEqual({ refusal: 'idioms-out-of-mix' });
    });

    it('hold Idioms by the Edition default Mix until the user chooses', async () => {
      const edition = {
        ...editionWith(true),
        userSettingDefaults: {
          ...editionWith(true).userSettingDefaults,
          mix: {
            categoryIds: 'all' as const,
            correctionCategoryIds: 'all' as const,
            corrections: true,
            idioms: false,
            synonymRows: true,
            tips: true,
          },
        },
      };
      const { entries } = await openOver({}, edition);

      expect(await entries.eligibleOfKind('idiom')).toEqual({ refusal: 'idioms-out-of-mix' });
    });

    it('leave Idioms, Synonym Rows and Tips untouched by the Rarity Floor', async () => {
      const edition = { ...editionWith(true), isFeatureEnabled: () => true };
      const { entries } = await openOver({ 'mix.rarityFloor': 5 }, edition);

      expect(await entries.eligible()).toEqual({
        words: [],
        corrections: ['c_always', 'c_chatty'],
        idioms: ['i_lazy', 'i_place'],
        synonymRows: ['r_walk'],
        tips: ['t_comma'],
      });
    });

    describe.each([
      { feature: 'synonymRows', record: 'mix.synonymRows', id: 'r_walk' },
      { feature: 'tips', record: 'mix.tips', id: 't_comma' },
    ] as const)('of the kind $feature', ({ feature, record, id }) => {
      it('hold the live ones while the kind is in the Mix, and none while it is out', async () => {
        const { port, entries } = await openOver({ [record]: false });

        expect((await entries.eligible())[feature]).toEqual([]);

        await port.write(new Map([[record, JSON.stringify(true)]]));

        expect((await entries.eligible())[feature]).toEqual([id]);
      });

      it('hold none by the Edition default Mix until the user chooses, then follow the choice', async () => {
        const edition = editionWith(true);
        const { port, entries } = await openOver(
          {},
          {
            ...edition,
            userSettingDefaults: {
              ...edition.userSettingDefaults,
              mix: { ...edition.userSettingDefaults.mix, [feature]: false },
            },
          },
        );

        expect((await entries.eligible())[feature]).toEqual([]);

        await port.write(new Map([[record, JSON.stringify(true)]]));

        expect((await entries.eligible())[feature]).toEqual([id]);
      });

      it('hold none when the Edition turns the kind off, even in the Mix', async () => {
        const { entries } = await openOver({ [record]: true }, editionWith(true, true, [feature]));

        expect((await entries.eligible())[feature]).toEqual([]);
      });

      it('hold none when the kind is turned off remotely, by the answer the device kept', async () => {
        const port = createMemoryUserStatePort();
        const userState = await openUserState({ port });
        await port.write(
          new Map([['edition.switches', JSON.stringify({ off: [feature], etag: `"${feature}"` })]]),
        );
        const remote = await openRemoteSwitches({
          edition: editionWith(true),
          backend: unreachableBackend(),
          userState,
          schedule: (run) => {
            run();
            return () => undefined;
          },
          random: randomOf(0),
        });
        const entries = createEntries({
          content: openContent(),
          edition: remote.edition,
          userState,
        });

        expect((await entries.eligible())[feature]).toEqual([]);
      });

      it('leave out a Hidden one, and hold it again once unhidden', async () => {
        const { port, entries } = await openOver({ [`hidden.${id}`]: '2026-10-26T06:00:00.000Z' });

        expect((await entries.eligible())[feature]).toEqual([]);

        await port.write(new Map([[`hidden.${id}`, undefined]]));

        expect((await entries.eligible())[feature]).toEqual([id]);
      });
    });

    it('are none in an empty Language Pack', async () => {
      const entries = createEntries({
        content: createMemoryContentPort(),
        edition: editionWith(true),
      });

      expect(await entries.eligible()).toEqual({
        words: [],
        corrections: [],
        idioms: [],
        synonymRows: [],
        tips: [],
      });
    });
  });

  describe('by id', () => {
    it('gives any Word, Correction or Idiom, a Retired one included, so kept Entries stay reachable', async () => {
      const entries = open();

      expect(await entries.get('w_talkative')).toEqual(talkative);
      expect(await entries.get('c_chatty')).toEqual(chatty);
      expect(await entries.get('i_lazy')).toMatchObject({ kind: 'idiom', id: 'i_lazy' });
      expect(await entries.get('w_gone')).toMatchObject({ retired: true });
      expect(await entries.get('c_old')).toMatchObject({ retired: true });
      expect(await entries.get('i_old')).toMatchObject({ retired: true });
    });

    it('gives a Correction the user keeps even when the Edition turns Corrections off', async () => {
      expect(await open({ correctionsSwitch: false }).get('c_chatty')).toEqual(chatty);
    });

    it('gives nothing for an unknown id', async () => {
      expect(await open().get('w_missing')).toBeUndefined();
    });

    it('gives many Entries at once as it gives each, leaving an unknown id out', async () => {
      const entries = open({ correctionsSwitch: false });
      const many = [
        'w_talkative',
        'c_chatty',
        'i_old',
        'w_gone',
        'c_old',
        'w_missing',
        'w_talkative',
      ];

      const found = await entries.getMany(many);

      expect([...found.keys()].toSorted()).toEqual([
        'c_chatty',
        'c_old',
        'i_old',
        'w_gone',
        'w_talkative',
      ]);
      for (const [id, entry] of found) expect(entry).toEqual(await entries.get(id));
      expect(await entries.getMany([])).toEqual(new Map());
    });

    it('reads one Entry of any kind, or many, in one read of the Language Pack', async () => {
      const counted = countingReads(openContent());
      const entries = createEntries({ content: counted.content, edition: editionWith(true) });

      await entries.get('i_lazy');
      expect(counted.reads()).toBe(1);

      await entries.getMany(['w_always', 'w_talkative', 'w_gone', 'c_chatty', 'c_old', 'i_old']);
      expect(counted.reads()).toBe(2);
    });
  });

  describe('links', () => {
    it('lead from a Word to its live Corrections in its order, past Retired and missing ones', async () => {
      expect(ids(await open().linkedCorrections(talkative))).toEqual(['c_chatty', 'c_always']);
    });

    it('lead from a Word to no Correction when the Edition turns Corrections off', async () => {
      const entries = open({ correctionsSwitch: false });

      expect(await entries.linkedCorrections(talkative)).toEqual([]);
    });

    it('lead from a Word to no Correction while Corrections are out of the Mix, and back when they return', async () => {
      const port = createMemoryUserStatePort();
      const entries = createEntries({
        content: createMemoryContentPort({ words: [talkative], corrections: [chatty, always] }),
        edition: editionWith(true),
        userState: await openUserState({ port }),
      });
      expect(ids(await entries.linkedCorrections(talkative))).toEqual(['c_chatty', 'c_always']);

      await port.write(new Map([['mix.corrections', JSON.stringify(false)]]));
      expect(await entries.linkedCorrections(talkative)).toEqual([]);

      await port.write(new Map([['mix.corrections', JSON.stringify(true)]]));
      expect(ids(await entries.linkedCorrections(talkative))).toEqual(['c_chatty', 'c_always']);
    });

    it('lead from a Word to no Synonym Row while Synonym Rows are out of the Mix, and back when they return', async () => {
      const row = synonymRow('r_talk');
      const linking: SynonymRow = {
        ...row,
        members: [{ text: 'балакучий', stress: [3], wordId: 'w_talkative' }, ...row.members],
      };
      const port = createMemoryUserStatePort();
      const entries = createEntries({
        content: createMemoryContentPort({ words: [talkative], synonymRows: [linking] }),
        edition: editionWith(true),
        userState: await openUserState({ port }),
      });
      expect((await entries.linkingSynonymRow(talkative))?.id).toBe('r_talk');

      await port.write(new Map([['mix.synonymRows', JSON.stringify(false)]]));
      expect(await entries.linkingSynonymRow(talkative)).toBeUndefined();

      await port.write(new Map([['mix.synonymRows', JSON.stringify(true)]]));
      expect((await entries.linkingSynonymRow(talkative))?.id).toBe('r_talk');
    });

    it('lead from a Retired Word to its live Corrections, so a kept Word keeps its links', async () => {
      expect(ids(await open().linkedCorrections(gone))).toEqual(['c_always']);
    });
  });
});
