import type { EditionStrings } from '@slovo/contracts';
import type { WordFeedCard } from '@slovo/core';
import { EditionProvider, EntryCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const strings = {
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    stress: 'stress on {vowels}',
    stressOr: 'or',
    illustration: 'Illustration of the word {lemma}',
    reveal: 'Show the meaning',
  },
} as unknown as EditionStrings;

/** A Word that names the Illustration `abacus.png`. */
const word: WordFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: {
    kind: 'word',
    wordId: 'w1',
    lemma: 'ábacus',
    stressedVowels: ['a'],
    partOfSpeech: 'noun',
    gender: undefined,
    primaryDefinition: 'A frame with beads for counting.',
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
    illustration: 'abacus.png',
  },
};

/** The Illustrations the app bundles, by file name, as Metro gives their assets. */
const illustrations = { 'abacus.png': 7 };

function inEdition(children: ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings} illustrations={illustrations}>
      {children}
    </EditionProvider>
  );
}

const label = 'Illustration of the word abacus';

describe('The Illustration on a Word card', () => {
  it('shows the Word’s image above the Definition, read by VoiceOver with the Lemma', async () => {
    await render(inEdition(<EntryCard card={word} />));

    const image = screen.getByRole('image', { name: label });
    expect(image).toHaveProp('source', 7);
    expect(image).toHaveStyle({ height: 160 });
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn.indexOf(label)).toBeLessThan(drawn.indexOf('A frame with beads for counting.'));
  });

  it('does nothing when tapped', async () => {
    await render(inEdition(<EntryCard card={word} />));

    const image = screen.getByRole('image', { name: label });
    expect(image).not.toHaveProp('onPress');
    await fireEvent.press(image);
    expect(screen.getByRole('image', { name: label })).toBeTruthy();
  });

  it('is absent from a Word without one, which looks as before', async () => {
    const plain = { ...word, model: { ...word.model, illustration: undefined } };
    await render(inEdition(<EntryCard card={plain} />));

    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.getByText('A frame with beads for counting.')).toBeTruthy();
  });

  it('is absent when the app bundles no file of that name', async () => {
    const unknown = { ...word, model: { ...word.model, illustration: 'missing.png' } };
    await render(inEdition(<EntryCard card={unknown} />));

    expect(screen.queryByRole('image')).toBeNull();
  });

  it('stays hidden with the meaning under Self-check', async () => {
    await render(inEdition(<EntryCard card={word} selfCheck />));

    expect(screen.queryByRole('image')).toBeNull();
    await fireEvent.press(screen.getByText('Show the meaning'));
    expect(screen.getByRole('image', { name: label })).toBeTruthy();
  });
});
