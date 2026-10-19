import type { EditionStrings } from '@slovo/contracts';
import type { EntryFeedCard, Haptics } from '@slovo/core';
import {
  EditionProvider,
  EntryCard,
  HapticsProvider,
  useSelfCheck,
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

const CARDS = [wordCard('first'), wordCard('second')];
const TURN_LABELS = { next: 'Next page', previous: 'Previous page' };
/** How long a page turn's motion takes, from the design. */
const SWIPE_MS = 420;

/** A Feed page: the Entry card, its meaning hidden while Self-check is `on`. */
function Page({ card, on }: { card: EntryFeedCard; on: boolean }) {
  const selfCheck = useSelfCheck(on);
  return <EntryCard card={card} hidden={selfCheck.hidden} onReveal={selfCheck.reveal} />;
}

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

async function renderFeed(on: boolean) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <VerticalPager
          testID="pager"
          items={CARDS}
          initialIndex={0}
          onIndexChange={jest.fn()}
          renderPage={(card) => <Page card={card} on={on} />}
          turnActionLabels={TURN_LABELS}
        />
      </HapticsProvider>
    </EditionProvider>,
  );
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
}

/** Turns the page with the VoiceOver action on the current card's Lemma. */
async function turn(from: string, actionName: 'next' | 'previous') {
  await fireEvent(screen.getByText(from), 'accessibilityAction', { nativeEvent: { actionName } });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWIPE_MS);
  });
}

describe('useSelfCheck', () => {
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

  it('hides nothing with Self-check off', async () => {
    await renderFeed(false);

    expect(screen.getByText('What first means.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show the meaning' })).toBeNull();
  });
});
