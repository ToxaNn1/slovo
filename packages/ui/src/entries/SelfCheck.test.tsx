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
    wordCard: {
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
      categoryId: 'k1',
      categoryName: undefined,
      details: undefined,
      linkedCorrections: [],
    },
  };
}

const correctionCard: EntryFeedCard = {
  kind: 'correction',
  correctionCard: {
    kind: 'correction',
    correctionId: 'c1',
    nonStandardForm: 'take part',
    nonStandardStressedVowels: [],
    mainEquivalent: 'join in',
    mainEquivalentStressedVowels: [],
    otherEquivalents: [],
    correctionType: 'calque',
    explanation: 'Why join in is better.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
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

/** Turns the page with the VoiceOver action on the current card's Lemma or non-standard form. */
async function turn(from: string, actionName: 'next' | 'previous') {
  const target =
    from === 'take part' ? screen.getByTestId('correction-non-standard') : screen.getByText(from);
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
});
