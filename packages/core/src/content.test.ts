import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import { createContent, type ContentReadPort, type Random } from './index';

function word(id: string, lemma: string, stress: number[], correctionIds: string[] = []): Word {
  return {
    kind: 'word',
    id,
    lemma,
    stress,
    partOfSpeech: 'adjective',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'test',
    rarity: 1,
    sources: [{ title: 'Test source' }],
    correctionIds,
    retired: false,
  };
}

function correction(
  id: string,
  nonStandardForm: string,
  standardEquivalents: string[],
): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm,
    correctionType: 'surzhyk',
    standardEquivalents,
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

const words: Word[] = [
  word('w_a', 'first', [1]),
  word('w_b', 'second', [1]),
  word('w_c', 'third', [2]),
];

function inMemoryPort(
  content: readonly Word[],
  corrections: readonly Correction[] = [],
): ContentReadPort {
  return {
    listWordIds: () => Promise.resolve(content.map((word) => word.id)),
    getWord: (id) => Promise.resolve(content.find((word) => word.id === id)),
    getCorrection: (id) => Promise.resolve(corrections.find((item) => item.id === id)),
    listLinkedWordIds: (correctionId) =>
      Promise.resolve(
        content
          .filter((word) => !word.retired && word.correctionIds.includes(correctionId))
          .map((word) => word.id),
      ),
  };
}

const fixedRandom = (value: number): Random => ({ next: () => value });

describe('content', () => {
  it('returns a Word by id', async () => {
    const content = createContent({ port: inMemoryPort(words), random: fixedRandom(0) });

    expect(await content.wordById('w_b')).toEqual(words[1]);
  });

  it('returns nothing for an unknown id', async () => {
    const content = createContent({ port: inMemoryPort(words), random: fixedRandom(0) });

    expect(await content.wordById('w_missing')).toBeUndefined();
  });

  it('returns the first Word in the pack order', async () => {
    const content = createContent({ port: inMemoryPort(words), random: fixedRandom(0.9) });

    expect(await content.firstWord()).toEqual(words[0]);
  });

  it.each([
    [0, 'w_a'],
    [0.5, 'w_b'],
    [0.999, 'w_c'],
  ])('picks a random Word using the random port (%s → %s)', async (value, expectedId) => {
    const content = createContent({ port: inMemoryPort(words), random: fixedRandom(value) });

    expect((await content.randomWord())?.id).toBe(expectedId);
  });

  it('returns no first or random Word from an empty pack', async () => {
    const content = createContent({ port: inMemoryPort([]), random: fixedRandom(0) });

    expect(await content.firstWord()).toBeUndefined();
    expect(await content.randomWord()).toBeUndefined();
  });

  describe('Corrections', () => {
    const corrections = [
      correction('c_a', 'allways', ['always']),
      correction('c_b', 'talkive', ['talkative', 'chatty']),
    ];
    const linkedWords = [
      word('w_always', 'always', [0], ['c_a']),
      word('w_talkative', 'talkative', [1], ['c_b', 'c_a']),
      word('w_plain', 'plain', [2]),
    ];
    const content = createContent({
      port: inMemoryPort(linkedWords, corrections),
      random: fixedRandom(0),
    });

    it('returns a Correction by id', async () => {
      expect(await content.correctionById('c_b')).toEqual(corrections[1]);
    });

    it('returns nothing for an unknown Correction id', async () => {
      expect(await content.correctionById('c_missing')).toBeUndefined();
    });

    it('returns the Corrections a Word is the standard form for, in the Word order', async () => {
      expect(await content.linkedCorrections('w_talkative')).toEqual([
        corrections[1],
        corrections[0],
      ]);
    });

    it('leaves a Retired Correction out of the Corrections linked to a Word, but returns it by id', async () => {
      const retired = { ...correction('c_old', 'oldform', ['always']), retired: true };
      const withRetired = createContent({
        port: inMemoryPort(
          [word('w_linked', 'always', [0], ['c_old', 'c_a'])],
          [...corrections, retired],
        ),
        random: fixedRandom(0),
      });

      expect(await withRetired.linkedCorrections('w_linked')).toEqual([corrections[0]]);
      expect(await withRetired.correctionById('c_old')).toEqual(retired);
    });

    it('returns no Corrections for a Word without links or an unknown Word', async () => {
      expect(await content.linkedCorrections('w_plain')).toEqual([]);
      expect(await content.linkedCorrections('w_missing')).toEqual([]);
    });

    it('returns the Words that are the standard form for a Correction', async () => {
      expect(await content.linkedWords('c_a')).toEqual([linkedWords[0], linkedWords[1]]);
      expect(await content.linkedWords('c_missing')).toEqual([]);
    });
  });
});
