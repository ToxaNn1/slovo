import { partOfSpeechText, wordGrammarText } from '@slovo/ui/part-of-speech';
import { describe, expect, it } from 'vitest';

type Strings = Parameters<typeof wordGrammarText>[0];

const strings: Strings = {
  partsOfSpeech: {
    noun: { short: 'n.', full: 'noun' },
    verb: { short: 'v.', full: 'verb' },
  } as Strings['partsOfSpeech'],
  genders: {
    feminine: { short: 'f.', full: 'feminine' },
  } as Strings['genders'],
  partOfSpeechWithGender: '{partOfSpeech}, {gender}',
  registers: {
    colloquial: { short: 'coll.', full: 'colloquial' },
    archaic: { short: 'arch.', full: 'archaic' },
  } as Strings['registers'],
  registerWithRegion: '{register}, {region}',
};

describe('partOfSpeechText', () => {
  it('is the part of speech alone without a gender', () => {
    expect(partOfSpeechText(strings, { partOfSpeech: 'verb', gender: undefined }, 'short')).toBe(
      'v.',
    );
  });

  it('joins the part of speech and the gender in the short form', () => {
    expect(partOfSpeechText(strings, { partOfSpeech: 'noun', gender: 'feminine' }, 'short')).toBe(
      'n., f.',
    );
  });

  it('spells both out in the full form', () => {
    expect(partOfSpeechText(strings, { partOfSpeech: 'noun', gender: 'feminine' }, 'full')).toBe(
      'noun, feminine',
    );
  });
});

describe('wordGrammarText', () => {
  const noun = { partOfSpeech: 'noun', gender: 'feminine', region: undefined } as const;

  it('is the part of speech alone without a register', () => {
    expect(wordGrammarText(strings, { ...noun, registers: [] }, 'short')).toBe('n., f.');
  });

  it('puts the registers after the part of speech on one short line', () => {
    expect(wordGrammarText(strings, { ...noun, registers: ['colloquial'] }, 'short')).toBe(
      'n., f. · coll.',
    );
  });

  it('keeps the Word’s order of registers', () => {
    expect(
      wordGrammarText(strings, { ...noun, registers: ['archaic', 'colloquial'] }, 'short'),
    ).toBe('n., f. · arch. · coll.');
  });

  it('separates the full words with commas for VoiceOver', () => {
    expect(
      wordGrammarText(
        strings,
        {
          partOfSpeech: 'verb',
          gender: undefined,
          registers: ['archaic', 'colloquial'],
          region: undefined,
        },
        'full',
      ),
    ).toBe('verb, archaic, colloquial');
  });
});
