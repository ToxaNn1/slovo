import type { EditionStrings } from '@slovo/contracts';
import { coreDecor, type Decor, type EntryFeedCard } from '@slovo/core';
import { DecorProvider, EditionProvider, EntryCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

const strings = {
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    registers: {},
    category: '{category}',
    synonym: 'Synonym',
    synonyms: 'Synonyms',
    antonym: 'Antonym',
    antonyms: 'Antonyms',
  },
  correctionCard: {
    title: 'Correction',
    correctionType: 'Type: {type}',
    correctionTypes: { calque: 'calque' },
    nonStandard: 'Non-standard',
    standard: 'Standard',
    otherEquivalents: 'Also: {equivalents}',
    exampleNonStandard: 'Not: {text}',
    exampleStandard: 'Right: {text}',
    source: 'Source: {source}',
  },
} as unknown as EditionStrings;

const card: EntryFeedCard = {
  kind: 'correction',
  correctionCard: {
    kind: 'correction',
    correctionId: 'c1',
    nonStandardForm: 'take part',
    mainEquivalent: 'join in',
    otherEquivalents: [],
    correctionType: 'calque',
    explanation: 'A long explanation.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
    sourceTitles: [],
  },
};

function cardWithSources(sourceTitles: readonly string[]): EntryFeedCard {
  if (card.kind !== 'correction') throw new Error('The fixture is a Correction card');
  return { ...card, correctionCard: { ...card.correctionCard, sourceTitles } };
}

const wordCard: EntryFeedCard = {
  kind: 'word',
  wordCard: {
    kind: 'word',
    wordId: 'w1',
    lemma: 'lemma',
    stressedVowels: [],
    partOfSpeech: 'noun',
    gender: undefined,
    primaryDefinition: 'What it means.',
    example: undefined,
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'k1',
    categoryName: undefined,
    details: undefined,
    linkedCorrections: [],
  },
};

const motif = {
  width: 4,
  height: 4,
  layers: [{ path: 'M0 0h4v4H0z', light: '#000', dark: '#fff' }],
};
const framedDecor: Decor = { ...coreDecor, corners: { corner: motif } };

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

describe('EntryCard', () => {
  it.each([
    ['Word', wordCard, 'word-card'],
    ['Correction', card, 'correction-card'],
  ])('draws the Decor frame on a %s card in all four corners', async (_kind, entry, testID) => {
    await render(
      inEdition(
        <DecorProvider decor={framedDecor}>
          <EntryCard card={entry} />
        </DecorProvider>,
      ),
    );

    const frame = within(screen.getByTestId(testID));
    for (const corner of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
      expect(frame.getByTestId(`card-corner-${corner}`, { hidden: true })).toBeTruthy();
    }
  });

  it('names the sources of a Correction in a line under the example pair', async () => {
    await render(inEdition(<EntryCard card={cardWithSources(['Sources A', 'Sources B'])} />));

    expect(screen.getByTestId('correction-source')).toHaveTextContent(
      'Source: Sources A; Sources B',
    );
  });

  it('draws no source line on a Correction without sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.queryByTestId('correction-source')).toBeNull();
  });

  it('draws no frame on a card when the Edition has no corners', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.queryByTestId('card-corner-topLeft', { hidden: true })).toBeNull();
  });
});
