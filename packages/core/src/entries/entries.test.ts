import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createEntries,
  createMemoryContentPort,
  createMemoryUserStatePort,
  openUserState,
  type Edition,
  type MixEdition,
} from '../index';

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
    sources: [{ title: 'Test source' }],
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

/** The Language Pack's Categories, in its order. */
const categories = [
  { id: 'speech', displayName: 'Speech' },
  { id: 'nature', displayName: 'Nature' },
];

/**
 * An Edition with the Corrections Feature Switch on or off, and `speech` and
 * `nature` in its default Mix.
 */
const editionWith = (corrections: boolean): Pick<Edition, 'isFeatureEnabled'> & MixEdition => ({
  isFeatureEnabled: (feature) => feature === 'corrections' && corrections,
  userSettingDefaults: { mix: { categoryIds: ['speech', 'nature'], corrections: true } },
});

const open = ({ correctionsSwitch = true } = {}) =>
  createEntries({
    content: createMemoryContentPort({ categories, words, corrections }),
    edition: editionWith(correctionsSwitch),
  });

const ids = (entries: readonly { id: string }[]) => entries.map(({ id }) => id);

describe('the Entries', () => {
  describe('eligible', () => {
    it('are the live Words and the live Corrections, each kind in the Language Pack order', async () => {
      expect(await open().eligible()).toEqual({
        words: ['w_always', 'w_talkative', 'w_plain'],
        corrections: ['c_always', 'c_chatty'],
      });
    });

    it('hold no Correction when the Edition turns Corrections off', async () => {
      expect(await open({ correctionsSwitch: false }).eligible()).toEqual({
        words: ['w_always', 'w_talkative', 'w_plain'],
        corrections: [],
      });
    });

    it('leave out every Hidden Entry, read afresh on every call', async () => {
      const port = createMemoryUserStatePort();
      const entries = createEntries({
        content: createMemoryContentPort({ categories, words, corrections }),
        edition: editionWith(true),
        userState: await openUserState({ port }),
      });
      await port.write(
        new Map([
          ['hidden.w_talkative', JSON.stringify('2026-10-11T06:00:00.000Z')],
          ['hidden.c_chatty', JSON.stringify('2026-10-11T06:00:00.000Z')],
        ]),
      );

      expect(await entries.eligible()).toEqual({
        words: ['w_always', 'w_plain'],
        corrections: ['c_always'],
      });

      await port.write(new Map([['hidden.w_talkative', undefined]]));

      expect(await entries.eligible()).toEqual({
        words: ['w_always', 'w_talkative', 'w_plain'],
        corrections: ['c_always'],
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
      });
    });

    it('are none in an empty Language Pack', async () => {
      const entries = createEntries({
        content: createMemoryContentPort(),
        edition: editionWith(true),
      });

      expect(await entries.eligible()).toEqual({ words: [], corrections: [] });
    });
  });

  describe('by id', () => {
    it('gives any Word or Correction, a Retired one included, so kept Entries stay reachable', async () => {
      const entries = open();

      expect(await entries.get('w_talkative')).toEqual(talkative);
      expect(await entries.get('c_chatty')).toEqual(chatty);
      expect(await entries.get('w_gone')).toMatchObject({ retired: true });
      expect(await entries.get('c_old')).toMatchObject({ retired: true });
    });

    it('gives a Correction the user keeps even when the Edition turns Corrections off', async () => {
      expect(await open({ correctionsSwitch: false }).get('c_chatty')).toEqual(chatty);
    });

    it('gives nothing for an unknown id', async () => {
      expect(await open().get('w_missing')).toBeUndefined();
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

    it('lead from a Retired Word to its live Corrections, so a kept Word keeps its links', async () => {
      expect(ids(await open().linkedCorrections(gone))).toEqual(['c_always']);
    });
  });
});
