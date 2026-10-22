import { wordGrammarText } from '@slovo/ui/part-of-speech';
import { describe, expect, it } from 'vitest';

import { strings as editionStrings } from '../test-support';

const strings = editionStrings.wordCard;

describe('the grammar line of a Word on its Share Card, in the Ukrainian Edition', () => {
  it('is the part of speech with gender when the Word has no register', () => {
    const word = {
      partOfSpeech: 'noun',
      gender: 'feminine',
      registers: [],
      region: undefined,
    } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('ім., ж. р.');
    expect(wordGrammarText(strings, word, 'full')).toBe('іменник, жіночий рід');
  });

  it('adds the register after the part of speech, as the Entry card does', () => {
    const word = {
      partOfSpeech: 'noun',
      gender: 'feminine',
      registers: ['colloquial'],
      region: undefined,
    } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('ім., ж. р. · розм.');
    expect(wordGrammarText(strings, word, 'full')).toBe('іменник, жіночий рід, розмовне');
  });

  it('keeps the registers in the Word’s order', () => {
    const word = {
      partOfSpeech: 'verb',
      gender: undefined,
      registers: ['dialectal', 'archaic'],
      region: undefined,
    } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('дієсл. · діал. · заст.');
    expect(wordGrammarText(strings, word, 'full')).toBe('дієслово, діалектне, застаріле');
  });

  it('names a dialect Word’s region after its dialectal register label', () => {
    const word = {
      partOfSpeech: 'noun',
      gender: 'masculine',
      registers: ['dialectal'],
      region: 'Гуцульщина',
    } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('ім., ч. р. · діал., Гуцульщина');
    expect(wordGrammarText(strings, word, 'full')).toBe(
      'іменник, чоловічий рід, діалектне, Гуцульщина',
    );
  });
});
