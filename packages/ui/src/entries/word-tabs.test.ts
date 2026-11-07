import type { WordCardModel } from '@slovo/core';
import { wordTabsOf } from '@slovo/ui/word-tabs';
import { describe, expect, it } from 'vitest';

const bare: WordCardModel = {
  kind: 'word',
  wordId: 'w1',
  lemma: 'meek',
  stressedVowels: [],
  partOfSpeech: 'noun',
  gender: undefined,
  primaryDefinition: 'Quiet and gentle.',
  example: undefined,
  synonyms: [],
  antonyms: [],
  registers: [],
  region: undefined,
  history: undefined,
  categoryId: 'k1',
  categoryName: undefined,
  details: undefined,
  linkedCorrections: [],
  synonymRow: undefined,
  illustration: undefined,
};

const full: WordCardModel = {
  ...bare,
  example: { text: 'A meek reply.', author: 'Author' },
  synonyms: ['mild'],
  antonyms: ['bold'],
  history: 'Old word.',
  details: {
    etymology: 'From Old Norse.',
    extraDefinitions: ['Submissive.', 'Tame.'],
    examples: [{ text: 'Meek as a lamb.', author: undefined }],
  },
};

describe('wordTabsOf', () => {
  it('gives a full Word the essence, example, links and history tabs in that order', () => {
    expect(wordTabsOf(full).map((tab) => tab.key)).toEqual([
      'essence',
      'example',
      'links',
      'history',
    ]);
  });

  it('counts the other meanings in the essence tab and lists them in the history tab', () => {
    const [essence, , , history] = wordTabsOf(full);
    expect(essence).toEqual({ key: 'essence', definition: 'Quiet and gentle.', moreMeanings: 2 });
    expect(history).toEqual({
      key: 'history',
      meanings: ['Submissive.', 'Tame.'],
      etymology: 'From Old Norse.',
      history: 'Old word.',
    });
  });

  it('keeps every Example in the example tab and both lists in the links tab', () => {
    const [, example, links] = wordTabsOf(full);
    expect(example).toEqual({
      key: 'example',
      examples: [
        { text: 'A meek reply.', author: 'Author' },
        { text: 'Meek as a lamb.', author: undefined },
      ],
    });
    expect(links).toEqual({ key: 'links', synonyms: ['mild'], antonyms: ['bold'] });
  });

  it('drops the tabs with nothing in them', () => {
    expect(wordTabsOf({ ...full, synonyms: [], antonyms: [] }).map((tab) => tab.key)).toEqual([
      'essence',
      'example',
      'history',
    ]);
    expect(wordTabsOf(bare)).toEqual([
      { key: 'essence', definition: 'Quiet and gentle.', moreMeanings: 0 },
    ]);
  });

  it('opens the links tab on antonyms alone and the history tab on the Word History alone', () => {
    const tabs = wordTabsOf({ ...bare, antonyms: ['bold'], history: 'Old word.' });
    expect(tabs.map((tab) => tab.key)).toEqual(['essence', 'links', 'history']);
  });
});
