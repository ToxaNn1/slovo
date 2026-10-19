import type { EditionStrings } from '@slovo/contracts';
import { coreDecor, type Decor, type EntryFeedCard } from '@slovo/core';
import { ActionRow, DecorProvider, EditionProvider, EntryCard, KnowledgeButtons } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';

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
  knowledge: {
    known: 'Known',
    unknown: 'Unknown',
    correctionKnownHint: 'I already say it right',
    review: 'Review',
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

  it.each([
    ['Word', wordCard],
    ['Correction', card],
  ])('labels a %s card brought back for Review', async (_kind, entry) => {
    await render(inEdition(<EntryCard card={{ ...entry, review: true }} />));

    expect(screen.getByText('Review')).toBeTruthy();
  });

  it.each([
    ['Word', wordCard],
    ['Correction', card],
  ])('draws no Review label on any other %s card', async (_kind, entry) => {
    await render(inEdition(<EntryCard card={entry} />));

    expect(screen.queryByText('Review')).toBeNull();
  });

  it('draws no frame on a card when the Edition has no corners', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.queryByTestId('card-corner-topLeft', { hidden: true })).toBeNull();
  });
});

/** The Correction card with its action row, the mark buttons there only when `marks` is on. */
function correctionWithMarks({
  marks,
  mark,
  onTap = jest.fn(),
}: {
  marks: boolean;
  mark?: 'known' | 'unknown';
  onTap?: (mark: 'known' | 'unknown') => void;
}) {
  return inEdition(
    <EntryCard
      card={card}
      actions={
        <ActionRow
          marks={
            marks ? (
              <KnowledgeButtons entryKind="correction" mark={mark} onTap={onTap} />
            ) : undefined
          }
          favorite={<Text>♡</Text>}
          collection={<Text>+</Text>}
          hide={<Text>×</Text>}
        />
      }
    />,
  );
}

describe('the mark buttons on a Correction card', () => {
  it('marks a Correction with no mark Known', async () => {
    const onTap = jest.fn();
    await render(correctionWithMarks({ marks: true, onTap }));

    expect(screen.getByRole('button', { name: 'Unknown', selected: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Known', selected: false }));

    expect(onTap).toHaveBeenCalledWith('known');
  });

  it('says on Known that the reader already says it right', async () => {
    await render(correctionWithMarks({ marks: true }));

    expect(screen.getByRole('button', { name: 'Known' })).toHaveProp(
      'accessibilityHint',
      'I already say it right',
    );
  });

  it('changes a Known Correction to Unknown', async () => {
    const onTap = jest.fn();
    await render(correctionWithMarks({ marks: true, mark: 'known', onTap }));

    expect(screen.getByRole('button', { name: 'Known', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', selected: false }));

    expect(onTap).toHaveBeenCalledWith('unknown');
  });

  it('removes the mark when its button is tapped again', async () => {
    const onTap = jest.fn();
    await render(correctionWithMarks({ marks: true, mark: 'unknown', onTap }));

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', selected: true }));

    expect(onTap).toHaveBeenCalledWith('unknown');
  });

  it('has no mark buttons with the Knowledge switch off', async () => {
    await render(correctionWithMarks({ marks: false }));

    expect(screen.getByTestId('action-row')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Known' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unknown' })).toBeNull();
  });
});
