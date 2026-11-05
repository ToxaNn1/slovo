import type { Haptics, WordFeedCard } from '@slovo/core';
import {
  EditionProvider,
  EntryCard,
  HapticsProvider,
  ReduceMotionProvider,
  RevealPace,
  VerticalPager,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    stress: 'stress on {vowels}',
    stressOr: 'or',
    reveal: 'Show the meaning',
  },
});

const card: WordFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: {
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

async function renderCard(reduceMotion: boolean, lemma = card.model.lemma) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <EntryCard
          card={{ ...card, model: { ...card.model, lemma } }}
          slots={{ slot: 'actions', actions: <Text>Actions</Text> }}
        />
      </ReduceMotionProvider>
    </EditionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

interface Style {
  opacity?: number;
  transform?: { translateY?: number }[];
}

function styleOf(testID: string) {
  const style = getAnimatedStyle(
    screen.getByTestId(testID, { includeHiddenElements: true }),
  ) as Style;
  return {
    opacity: style.opacity ?? 1,
    rise: style.transform?.find((step) => step.translateY !== undefined)?.translateY ?? 0,
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('the Entry card reveal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('flies the Lemma in as one, then raises the details after it', async () => {
    await renderCard(false);

    // The whole headline flies as one layer, from below and unseen.
    expect(
      screen.getAllByTestId('word-lemma-flying', { includeHiddenElements: true }),
    ).toHaveLength(1);
    expect(styleOf('word-lemma-flying').opacity).toBe(0);
    expect(styleOf('word-actions').opacity).toBe(0);

    // The headline is on its way while the details still wait their turn.
    await wait(120 + 100);
    expect(styleOf('word-lemma-flying').opacity).toBeGreaterThan(0);
    expect(styleOf('word-lemma-flying').opacity).toBeLessThan(1);
    expect(styleOf('word-actions').opacity).toBe(0);

    await wait(1000 - 220);
    expect(styleOf('word-lemma-flying').opacity).toBeCloseTo(1);
    expect(styleOf('word-lemma-flying').rise).toBeCloseTo(0);
    expect(styleOf('word-actions').opacity).toBeCloseTo(1);
    expect(styleOf('word-actions').rise).toBeCloseTo(0);
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('settles within a second, however long the Lemma', async () => {
    // 15 letters, as long as a rare Lemma runs.
    await renderCard(false, 'incomprehension');

    await wait(1000);
    expect(styleOf('word-lemma-flying')).toEqual({
      opacity: expect.closeTo(1),
      rise: expect.closeTo(0),
    });
    expect(styleOf('word-actions')).toEqual({
      opacity: expect.closeTo(1),
      rise: expect.closeTo(0),
    });
  });

  it('under Reduce Motion fades the card in once and moves nothing', async () => {
    await renderCard(true);

    expect(screen.queryByTestId('word-lemma-flying', { includeHiddenElements: true })).toBeNull();
    expect(styleOf('word-actions')).toEqual({ opacity: 1, rise: 0 });
    expect(styleOf('word-card').opacity).toBeLessThan(1);

    await wait(300);
    expect(styleOf('word-card').opacity).toBeCloseTo(1);
    expect(screen.getByText('lemma')).toBeTruthy();
  });

  it('under Reduce Motion fades in once at either pace', async () => {
    await renderFeed({ fast: true, visiting: true, card: 'w1', reduceMotion: true });
    await rerenderFeed({ fast: true, visiting: true, card: 'w2', reduceMotion: true });

    expect(screen.queryByTestId('word-lemma-flying', { includeHiddenElements: true })).toBeNull();
    expect(styleOf('word-actions')).toEqual({ opacity: 1, rise: 0 });
    expect(styleOf('word-card').opacity).toBeLessThan(1);
    await wait(300);
    expect(styleOf('word-card').opacity).toBeCloseTo(1);
  });
});

/** Whether the card on screen shows its actions this long after it started to play: the fast reveal has, the full one not yet. */
async function actionsShownAfter(ms: number) {
  await wait(ms);
  return styleOf('word-actions').opacity > 0.99;
}

interface FeedVisit {
  fast: boolean;
  visiting: boolean;
  /** The Entry of the card on screen; another one is a card reached by scrolling. */
  card: string;
  reduceMotion?: boolean;
}

function feed({ fast, visiting, card: entryId, reduceMotion = false }: FeedVisit) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <RevealPace fast={fast} visiting={visiting}>
          <EntryCard
            key={entryId}
            card={{ ...card, entryId }}
            slots={{ slot: 'actions', actions: <Text>Actions</Text> }}
          />
        </RevealPace>
      </ReduceMotionProvider>
    </EditionProvider>
  );
}

let rerender: ((element: ReactElement) => Promise<void>) | undefined;

async function renderFeed(visit: FeedVisit) {
  const rendered = await render(feed(visit));
  rerender = async (element) => {
    await rendered.rerender(element);
  };
  await act(async () => {
    await Promise.resolve();
  });
}

async function rerenderFeed(visit: FeedVisit) {
  if (rerender === undefined) throw new Error('Render the Feed first');
  await rerender(feed(visit));
  await act(async () => {
    await Promise.resolve();
  });
}

describe('the pace of the Entry card reveal in one visit to the Feed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('plays the full reveal on the first card and the fast one on the next card', async () => {
    await renderFeed({ fast: true, visiting: true, card: 'w1' });
    expect(await actionsShownAfter(450)).toBe(false);
    await wait(1000);
    expect(styleOf('word-actions').opacity).toBeCloseTo(1);

    await rerenderFeed({ fast: true, visiting: true, card: 'w2' });
    expect(styleOf('word-actions').opacity).toBe(0);
    expect(await actionsShownAfter(450)).toBe(true);
    expect(styleOf('word-lemma-flying').opacity).toBeCloseTo(1);
  });

  it('plays the full reveal again on the first card after the Feed comes back in sight', async () => {
    await renderFeed({ fast: true, visiting: true, card: 'w1' });
    await wait(1500);
    await rerenderFeed({ fast: true, visiting: true, card: 'w2' });
    await wait(1500);

    await rerenderFeed({ fast: true, visiting: false, card: 'w2' });
    await rerenderFeed({ fast: true, visiting: true, card: 'w3' });
    expect(await actionsShownAfter(450)).toBe(false);

    await rerenderFeed({ fast: true, visiting: true, card: 'w4' });
    expect(await actionsShownAfter(450)).toBe(true);
  });

  it('plays the full reveal on every card with the fast reveal switched off', async () => {
    await renderFeed({ fast: false, visiting: true, card: 'w1' });
    await wait(1500);

    await rerenderFeed({ fast: false, visiting: true, card: 'w2' });
    expect(await actionsShownAfter(450)).toBe(false);
    await wait(1000);
    expect(styleOf('word-actions').opacity).toBeCloseTo(1);
  });
});

const LEMMAS = ['first', 'second', 'third', 'fourth'];
const hidden = { includeHiddenElements: true };

/** The Feed's pager of Word cards, one per Lemma, under the reader's Reduce Motion setting. */
async function renderPager(reduceMotion = false) {
  const haptics: Haptics = {
    selection: jest.fn(),
    impactLight: jest.fn(),
    impactMedium: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  };
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="feed"
            items={LEMMAS}
            onIndexChange={jest.fn()}
            renderPage={(lemma) => (
              <EntryCard
                card={{ ...card, entryId: lemma, model: { ...card.model, lemma } }}
                slots={{ slot: 'actions', actions: <Text>{`Actions of ${lemma}`}</Text> }}
              />
            )}
          />
        </HapticsProvider>
      </ReduceMotionProvider>
    </EditionProvider>,
  );
  await fireEvent(screen.getByTestId('feed'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
  await act(async () => {
    await Promise.resolve();
  });
}

/** A quick flick up to the next card, let go before the last one settled. */
async function flickUp() {
  await act(() => {
    fireGestureHandler(getByGestureTestId('feed-swipe'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: -12, velocityY: -1500 },
      { state: State.ACTIVE, translationY: -12, velocityY: -1500 },
      { state: State.ACTIVE, translationY: -200, velocityY: -1500 },
      { state: State.END, translationY: -200, velocityY: -1500 },
    ]);
  });
}

/** How a part of the card with `lemma` looks: its headline, or its action row. */
function cardPart(lemma: string, part: 'word-lemma-flying' | 'word-actions') {
  const text = part === 'word-actions' ? `Actions of ${lemma}` : lemma;
  const node = screen
    .getAllByTestId(part, hidden)
    .find((candidate) => within(candidate).queryAllByText(text, hidden).length > 0);
  if (node === undefined) throw new Error(`No ${part} of «${lemma}» is drawn.`);
  const style = getAnimatedStyle(node) as Style;
  return {
    opacity: style.opacity ?? 1,
    rise: style.transform?.find((step) => step.translateY !== undefined)?.translateY ?? 0,
  };
}

const revealed = { opacity: expect.closeTo(1), rise: expect.closeTo(0) };

describe('the Entry card reveal in the Feed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('starts the reveal of a card only once the Feed settles on it', async () => {
    await renderPager();
    await wait(1000);

    await flickUp();
    await wait(100);
    // Still moving in: the headline waits unseen.
    expect(cardPart('second', 'word-lemma-flying').opacity).toBe(0);

    await wait(200 + 250);
    expect(cardPart('second', 'word-lemma-flying').opacity).toBeGreaterThan(0);
    expect(cardPart('second', 'word-actions').opacity).toBe(0);
    await wait(1000);
    expect(cardPart('second', 'word-lemma-flying')).toEqual(revealed);
    expect(cardPart('second', 'word-actions')).toEqual(revealed);
  });

  it('shows a card swiped past before it settled in its final frame', async () => {
    await renderPager();
    await wait(1000);

    await flickUp();
    await wait(100);
    await flickUp();

    // The passed card is whole at once, never half-drawn, as it leaves.
    expect(cardPart('second', 'word-lemma-flying')).toEqual(revealed);
    expect(cardPart('second', 'word-actions')).toEqual(revealed);
    // The card the Feed heads for waits for the Feed to settle on it.
    expect(cardPart('third', 'word-lemma-flying').opacity).toBe(0);
    await wait(300 + 1000);
    expect(cardPart('third', 'word-lemma-flying')).toEqual(revealed);
    expect(cardPart('second', 'word-lemma-flying')).toEqual(revealed);
  });

  it('plays the reveal once, and shows it whole when the reader comes back', async () => {
    await renderPager();
    await wait(1000);
    await flickUp();
    await wait(300 + 1000);

    // Back to the first card: it moves in revealed and stays so.
    await act(() => {
      fireGestureHandler(getByGestureTestId('feed-swipe'), [
        { state: State.BEGAN, translationY: 0, velocityY: 0 },
        { state: State.ACTIVE, translationY: 12, velocityY: 1500 },
        { state: State.ACTIVE, translationY: 12, velocityY: 1500 },
        { state: State.ACTIVE, translationY: 200, velocityY: 1500 },
        { state: State.END, translationY: 200, velocityY: 1500 },
      ]);
    });
    for (const ms of [50, 300, 200]) {
      await wait(ms);
      expect(cardPart('first', 'word-lemma-flying')).toEqual(revealed);
      expect(cardPart('first', 'word-actions')).toEqual(revealed);
    }
  });
});
