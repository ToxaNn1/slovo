import { describe, expect, it } from 'vitest';

import type { Word } from '@slovo/contracts';

import { createContent, type ContentReadPort, type Random } from './index';

const words: Word[] = [
  {
    id: 'w_a',
    lemma: 'перший',
    stress: [1],
    partOfSpeech: 'adjective',
    primaryDefinition: 'Перше значення.',
    categoryId: 'test',
  },
  {
    id: 'w_b',
    lemma: 'другий',
    stress: [4],
    partOfSpeech: 'adjective',
    primaryDefinition: 'Друге значення.',
    categoryId: 'test',
  },
  {
    id: 'w_c',
    lemma: 'третій',
    stress: [2],
    partOfSpeech: 'adjective',
    primaryDefinition: 'Третє значення.',
    categoryId: 'test',
  },
];

function inMemoryPort(content: readonly Word[]): ContentReadPort {
  return {
    listWordIds: () => Promise.resolve(content.map((word) => word.id)),
    getWord: (id) => Promise.resolve(content.find((word) => word.id === id)),
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
});
