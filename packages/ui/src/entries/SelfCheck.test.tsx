import type { EditionStrings } from '@slovo/contracts';
import type { EntryFeedCard, Haptics } from '@slovo/core';
import {
  EditionProvider,
  EntryCard,
  HapticsProvider,
  KnowledgeButtons,
  VerticalPager,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const strings = {
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    registers: {},
    category: '{category}',
    reveal: 'Show the meaning',
    extraDefinitions: 'Other meanings',
    example: '{text}',
  },
  idiomCard: {
    idiomTypes: { idiom: 'idiom', placeName: 'place name' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
  },
  correctionCard: {
    title: 'Correction',
    correctionTypes: { calque: 'calque' },
    correctionType: 'Type: {type}',
    nonStandard: 'Non-standard',
    standard: 'Standard',
    otherEquivalents: 'Also: {equivalents}',
    exampleNonStandard: 'Not: {text}',
    exampleStandard: 'Right: {text}',
    source: 'Source: {source}',
    howToSay: 'How to say it?',
    reveal: 'Show',
  },
  knowledge: { known: 'Known', unknown: 'Unknown', correctionKnownHint: 'I say it right' },
} as unknown as EditionStrings;

function wordCard(lemma: string): EntryFeedCard {
  return {
    kind: 'word',
    entryId: lemma,
    model: {
      kind: 'word',
      wordId: lemma,
      lemma,
      stressedVowels: [],
      partOfSpeech: 'noun',
      gender: undefined,
      primaryDefinition: `What ${lemma} means.`,
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
      illustration: undefined,
    },
  };
}

const correctionCard: EntryFeedCard = {
  kind: 'correction',
  entryId: 'c1',
  model: {
    kind: 'correction',
    correctionId: 'c1',
    nonStandardForm: 'take part',
    nonStandardStressedVowels: [],
    mainEquivalent: 'join in',
    mainEquivalentStressedVowels: [],
    otherEquivalents: [],
    correctionType: 'calque',
    categoryId: 'everyday',
    categoryName: 'Everyday speech',
    explanation: 'Why join in is better.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
    sourceTitles: [],
    literaryUses: [],
  },
};

const idiomCard: EntryFeedCard = {
  kind: 'idiom',
  entryId: 'i1',
  model: {
    kind: 'idiom',
    idiomId: 'i1',
    expression: 'to beat the bushes',
    idiomType: 'idiom',
    primaryDefinition: 'To idle about.',
    extraDefinitions: ['To search everywhere.'],
    examples: [{ text: 'He beat the bushes all day.' }],
    etymology: 'From the hunt.',
    sourceTitles: [],
  },
};

const CARDS = [wordCard('first'), wordCard('second')];
const TURN_LABELS = { next: 'Next page', previous: 'Previous page' };
/** How long a page turn's motion takes, from the design. */
const SWIPE_MS = 420;

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

async function renderFeed(
  on: boolean,
  cards: readonly EntryFeedCard[] = CARDS,
  onMark: (mark: 'known' | 'unknown') => void = jest.fn(),
) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <VerticalPager
          testID="pager"
          items={cards}
          initialIndex={0}
          onIndexChange={jest.fn()}
          renderPage={(card) => (
            <EntryCard
              card={card}
              selfCheck={on}
              actions={<KnowledgeButtons entryKind={card.kind} mark={undefined} onTap={onMark} />}
            />
          )}
          turnActionLabels={TURN_LABELS}
        />
      </HapticsProvider>
    </EditionProvider>,
  );
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
}

/** Turns the page with the VoiceOver action on the current card's Lemma, non-standard form or expression. */
async function turn(from: string, actionName: 'next' | 'previous') {
  const target =
    from === 'take part'
      ? screen.getByTestId('correction-non-standard')
      : from === 'to beat the bushes'
        ? screen.getByTestId('idiom-expression')
        : screen.getByText(from);
  await fireEvent(target, 'accessibilityAction', { nativeEvent: { actionName } });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWIPE_MS);
  });
}

describe('Self-check', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides the meaning until the reader reveals it', async () => {
    await renderFeed(true);
    expect(screen.queryByText('What first means.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByText('What first means.')).toBeTruthy();
  });

  it('hides the meaning again once the card has left the screen', async () => {
    await renderFeed(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    await turn('first', 'next');
    await turn('second', 'previous');

    expect(screen.queryByText('What first means.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show the meaning' })).toBeTruthy();
  });

  it('keeps the card revealed while it slides out of view', async () => {
    await renderFeed(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    await fireEvent(screen.getByText('first'), 'accessibilityAction', {
      nativeEvent: { actionName: 'next' },
    });

    // The card on its way out is no longer the reader's, so VoiceOver no longer reaches it.
    expect(screen.getByText('What first means.', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps the marks of a Word inactive until the reader reveals it', async () => {
    const onMark = jest.fn();
    await renderFeed(true, CARDS, onMark);
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', disabled: true }));
    expect(onMark).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: false }));
    expect(onMark).toHaveBeenCalledWith('known');
  });

  it('hides nothing with Self-check off', async () => {
    await renderFeed(false);

    expect(screen.getByText('What first means.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show the meaning' })).toBeNull();
  });

  it('hides the right form of a Correction and its marks until the reader reveals it', async () => {
    const onMark = jest.fn();
    await renderFeed(true, [correctionCard, wordCard('second')], onMark);
    expect(screen.queryByText('Why join in is better.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: true }));
    expect(onMark).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('Why join in is better.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', disabled: false }));
    expect(onMark).toHaveBeenCalledWith('unknown');
  });

  it('hides the Correction again once its card has left the screen', async () => {
    await renderFeed(true, [correctionCard, wordCard('second')]);
    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    await turn('take part', 'next');
    await turn('second', 'previous');

    expect(screen.queryByText('Why join in is better.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show' })).toBeTruthy();
  });

  it('shows only the expression and chip of an Idiom, its marks inactive, until the reader reveals it', async () => {
    const onMark = jest.fn();
    await renderFeed(true, [idiomCard, wordCard('second')], onMark);
    expect(screen.getByRole('header', { name: 'to beat the bushes, idiom' })).toBeTruthy();
    for (const concealed of ['To idle about.', '2. To search everywhere.', 'From the hunt.']) {
      expect(screen.queryByText(concealed)).toBeNull();
    }
    expect(screen.queryByTestId('idiom-example')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: true }));
    expect(onMark).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByText('To idle about.')).toBeTruthy();
    expect(screen.getByText('2. To search everywhere.')).toBeTruthy();
    expect(screen.getByTestId('idiom-example')).toHaveTextContent('He beat the bushes all day.');
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent('OriginFrom the hunt.');
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: false }));
    expect(onMark).toHaveBeenCalledWith('known');
  });

  it('hides the Idiom again once its card has left the screen', async () => {
    await renderFeed(true, [idiomCard, wordCard('second')]);
    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    await turn('to beat the bushes', 'next');
    await turn('second', 'previous');

    expect(screen.queryByText('To idle about.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show the meaning' })).toBeTruthy();
  });
});
