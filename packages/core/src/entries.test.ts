import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import { createEntries, createMemoryContentPort, type Edition } from './index';

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

/** An Edition with the Corrections Feature Switch on or off. */
const editionWith = (corrections: boolean): Pick<Edition, 'isFeatureEnabled'> => ({
  isFeatureEnabled: (feature) => feature === 'corrections' && corrections,
});

const open = ({ correctionsSwitch = true } = {}) =>
  createEntries({
    content: createMemoryContentPort({ words, corrections }),
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

    it('lead from a Retired Word to its live Corrections, so a kept Word keeps its links', async () => {
      expect(ids(await open().linkedCorrections(gone))).toEqual(['c_always']);
    });

    it('lead from a Correction to its live Words, past Retired ones', async () => {
      const entries = open();

      expect(ids(await entries.linkedWords(always))).toEqual(['w_always', 'w_talkative']);
      expect(await entries.linkedWords(correction('c_unlinked'))).toEqual([]);
    });
  });
});
