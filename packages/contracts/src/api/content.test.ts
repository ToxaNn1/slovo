import { describe, expect, it } from 'vitest';

import { PatchSchema } from './content';

// A field a later backend adds, which an older app must take without refusing the Patch (ADR 0031).
const later = { addedLater: 'x' };

const source = { title: 'СУМ', ...later };
const example = { text: 'Приклад.', ...later };
const rowWord = (text: string) => ({ text, stress: [0], ...later });

const patch = {
  editionId: 'uk',
  since: 0,
  contentVersion: 1,
  patchFormat: 2,
  words: [
    {
      id: 'w_1',
      lemma: 'олія',
      partOfSpeech: 'noun',
      gender: 'feminine',
      primaryDefinition: 'Жир.',
      examples: [example],
      categoryId: 'c',
      rarity: 3,
      sources: [source],
      ...later,
    },
  ],
  idioms: [
    {
      id: 'i_1',
      expression: 'бити байдики',
      idiomType: 'idiom',
      primaryDefinition: 'Ледарювати.',
      examples: [example],
      sources: [source],
      ...later,
    },
  ],
  corrections: [
    {
      id: 'c_1',
      nonStandardForm: 'приймати участь',
      correctionType: 'calque',
      standardEquivalents: ['брати участь'],
      explanation: 'Так кажуть.',
      examplePair: { nonStandard: 'Я приймаю участь.', standard: 'Я **беру участь**.', ...later },
      categoryId: 'c',
      sources: [source],
      literaryUses: [{ text: 'Т.', author: 'А.', work: 'Р.', authorDeathYear: 1900, ...later }],
      ...later,
    },
  ],
  tips: [
    {
      id: 't_1',
      title: 'Котра година?',
      standardForm: 'Котра година?',
      explanation: 'Так.',
      example,
      exceptions: { explanation: 'Ні.', words: ['о'], ...later },
      sources: [source],
      gameQuestion: { prompt: 'Як?', rightAnswer: 'Так', wrongAnswers: ['а', 'б', 'в'], ...later },
      ...later,
    },
  ],
  synonymRows: [
    {
      id: 'r_1',
      dominant: rowWord('йти'),
      meaning: 'Рухатися.',
      members: ['іти', 'ступати', 'крокувати', 'брести', 'чвалати'].map(rowWord),
      example,
      sources: [source],
      ...later,
    },
  ],
  curatedCollections: [
    {
      id: 'cc_1',
      name: 'Добірка',
      description: 'Слова.',
      publishedOn: '2026-11-13',
      entryIds: ['w_1'],
      ...later,
    },
  ],
  crosswordDays: [],
  mediaBase: 'https://media.example.org',
  recordings: [
    {
      wordId: 'w_1',
      hash: 'a'.repeat(64),
      size: 1,
      retired: false,
      narratorVoice: 'oleksa',
      recordingKind: 'plain',
      durationMs: 1,
      ...later,
    },
  ],
  illustrations: [{ wordId: 'w_1', hash: 'a'.repeat(64), size: 1, retired: false, ...later }],
  ...later,
};

describe('a Patch', () => {
  it('takes records, their parts and media rows that carry a field added later', () => {
    const parsed = PatchSchema.safeParse(patch);

    expect(parsed.error?.issues).toBeUndefined();
    expect(parsed.data?.words[0]?.examples[0]?.text).toBe('Приклад.');
  });

  it('still checks the rules of a record', () => {
    const noun = { ...patch.words[0], gender: undefined };

    expect(PatchSchema.safeParse({ ...patch, words: [noun] }).success).toBe(false);
  });
});
