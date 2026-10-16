import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EditionStringsSchema } from '@slovo/contracts';
import { wordGrammarText } from '@slovo/ui/part-of-speech';
import { describe, expect, it } from 'vitest';

const strings = EditionStringsSchema.parse(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../../../editions/uk/strings.json', import.meta.url)),
      'utf8',
    ),
  ),
).wordCard;

describe('the grammar line of a Word on its Share Card, in the Ukrainian Edition', () => {
  it('is the part of speech with gender when the Word has no register', () => {
    const word = { partOfSpeech: 'noun', gender: 'feminine', registers: [] } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('ім., ж. р.');
    expect(wordGrammarText(strings, word, 'full')).toBe('іменник, жіночий рід');
  });

  it('adds the register after the part of speech, as the Entry card does', () => {
    const word = { partOfSpeech: 'noun', gender: 'feminine', registers: ['colloquial'] } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('ім., ж. р. · розм.');
    expect(wordGrammarText(strings, word, 'full')).toBe('іменник, жіночий рід, розмовне');
  });

  it('keeps the registers in the Word’s order', () => {
    const word = {
      partOfSpeech: 'verb',
      gender: undefined,
      registers: ['dialectal', 'archaic'],
    } as const;

    expect(wordGrammarText(strings, word, 'short')).toBe('дієсл. · діал. · заст.');
    expect(wordGrammarText(strings, word, 'full')).toBe('дієслово, діалектне, застаріле');
  });
});
