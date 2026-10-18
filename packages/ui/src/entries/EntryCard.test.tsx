import type { EditionStrings } from '@slovo/contracts';
import { coreDecor, type Decor, type EntryFeedCard, type Haptics } from '@slovo/core';
import {
  DecorProvider,
  EditionProvider,
  EntryCard,
  HapticsProvider,
  VerticalPager,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

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

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const actions = <Text testID="card-actions">actions</Text>;

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

/** The style of the element with this test ID, flattened. */
function styleOf(testID: string) {
  return StyleSheet.flatten(
    (screen.getByTestId(testID).props as { style?: StyleProp<ViewStyle> }).style,
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

  it('scrolls its text inside the frame in the Feed and keeps the actions below it', async () => {
    await render(
      inEdition(
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={[card]}
            onIndexChange={() => undefined}
            renderPage={(item) => <EntryCard card={item} actions={actions} scrollable />}
          />
        </HapticsProvider>,
      ),
    );
    await fireEvent(screen.getByTestId('pager'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });

    const scroll = within(screen.getByTestId('entry-card-scroll'));
    expect(scroll.getByTestId('correction-explanation')).toBeTruthy();
    expect(scroll.queryByTestId('card-actions')).toBeNull();
    const frame = within(screen.getByTestId('correction-card'));
    expect(frame.getByTestId('entry-card-scroll')).toBeTruthy();
    expect(screen.getByTestId('card-actions')).toBeTruthy();
  });

  it('centres a card that fits and lets a card that does not fit fill the space and scroll', async () => {
    await render(
      inEdition(
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={[card]}
            onIndexChange={() => undefined}
            renderPage={(item) => <EntryCard card={item} actions={actions} scrollable />}
          />
        </HapticsProvider>,
      ),
    );
    await fireEvent(screen.getByTestId('pager'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });

    // The card and its actions take the height they need and sit in the middle
    // of the page; when that is more than the page has, the card shrinks to
    // the space left, so it fills the page from the top and scrolls.
    const page = styleOf('entry-card-page');
    expect(page).toMatchObject({ flexGrow: 1, justifyContent: 'center' });
    const frame = styleOf('correction-card');
    expect(frame).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    const scroll = styleOf('entry-card-scroll');
    expect(scroll).toMatchObject({ flexGrow: 0, flexShrink: 1 });
  });

  it('draws the card without a scroll of its own outside the Feed', async () => {
    await render(inEdition(<EntryCard card={card} actions={actions} />));

    expect(screen.queryByTestId('entry-card-scroll')).toBeNull();
    expect(screen.getByTestId('correction-explanation')).toBeTruthy();
    expect(screen.getByTestId('card-actions')).toBeTruthy();
  });
});
