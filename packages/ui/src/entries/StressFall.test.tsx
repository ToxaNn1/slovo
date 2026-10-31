import {
  buildShareCardContent,
  type EntryFeedCard,
  type EntryRowModel,
  type Haptics,
  type WordFeedCard,
} from '@slovo/core';
import {
  EditionProvider,
  EntryCard,
  EntryRow,
  HapticsProvider,
  ShareSheet,
  VerticalPager,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    stress: 'stress on {vowels}',
    stressOr: 'or',
  },
  share: {
    title: 'Share the card',
    format: 'Format',
    story: 'Story',
    square: 'Square',
    share: 'Share',
    captureFailed: 'Could not make the image.',
  },
  correctionCard: { correctionTypes: { calque: 'calque' } },
});

/** A Word whose Lemma carries its Stress mark after the stressed vowel. */
const word: WordFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: {
    kind: 'word',
    wordId: 'w1',
    lemma: 'catálog',
    stressedVowels: ['a'],
    partOfSpeech: 'noun',
    gender: undefined,
    primaryDefinition: 'A list of things.',
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

const row: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'catálog',
  secondLine: 'A list of things.',
  labelKey: 'word',
  spoken: 'catalog, A list of things.',
  partOfSpeech: 'noun',
  registers: [],
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** How long a page turn's motion takes, from the design. */
const SWIPE_MS = 420;

function inEdition(children: ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

/** Lets the system answer whether Reduce Motion is on. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** A Word card of the Lemma, with its Stress on the first vowel. */
function wordOf(lemma: string): WordFeedCard {
  return {
    ...word,
    entryId: lemma,
    model: { ...word.model, wordId: lemma, lemma, stressedVowels: [lemma.charAt(0)] },
  };
}

/** Where the falling Stress marks of the Lemma are: their height above their vowels and their opacity. */
function marks(lemma = word.model.lemma): { above: number; opacity: number } {
  const layer = screen
    .getAllByTestId('word-lemma-falling', { includeHiddenElements: true })
    .find((falling) =>
      screen
        .getAllByText(lemma, { includeHiddenElements: true })
        .some((text) => falling.children.includes(text)),
    );
  if (layer === undefined) throw new Error(`No Stress of ${lemma} falls.`);
  const style = getAnimatedStyle(layer) as {
    opacity?: number;
    transform?: { translateY?: number }[];
  };
  const shift = style.transform?.find((step) => step.translateY !== undefined)?.translateY ?? 0;
  return { above: -shift, opacity: style.opacity ?? 1 };
}

async function advance(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('The falling Stress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('falls onto its vowel in 300 ms when the Word card appears', async () => {
    await render(inEdition(<EntryCard card={word} stressFalls />));
    await settle();

    const start = marks();
    await advance(150);
    const midway = marks();
    await advance(170);
    const end = marks();

    expect(start.above).toBeGreaterThan(0);
    expect(start.opacity).toBe(0);
    expect(midway.above).toBeGreaterThan(0);
    expect(midway.above).toBeLessThan(start.above);
    expect(end.above).toBeCloseTo(0);
    expect(end.opacity).toBe(1);
  });

  it('falls again each time the reader turns back to the card in the Feed', async () => {
    const first = 'fi\u0301rst';
    await render(
      inEdition(
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={[wordOf(first), wordOf('se\u0301cond')]}
            initialIndex={0}
            onIndexChange={jest.fn()}
            renderPage={(card) => <EntryCard card={card} stressFalls />}
            turnActionLabels={{ next: 'Next page', previous: 'Previous page' }}
          />
        </HapticsProvider>,
      ),
    );
    await fireEvent(screen.getByTestId('pager'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });
    await settle();
    await advance(SWIPE_MS);
    const turn = async (from: string, actionName: 'next' | 'previous') => {
      await fireEvent(
        screen.getByRole('header', { name: `${from}, stress on ${from.charAt(0)}` }),
        'accessibilityAction',
        {
          nativeEvent: { actionName },
        },
      );
      await settle();
    };

    await turn('first', 'next');
    await advance(SWIPE_MS);
    await turn('second', 'previous');
    const back = marks(first);
    await advance(SWIPE_MS);
    const landed = marks(first);

    expect(back.opacity).toBeLessThan(1);
    expect(landed.above).toBeCloseTo(0);
    expect(landed.opacity).toBe(1);
  });

  it('keeps the mark of the next card unseen above its vowel until that card is on screen', async () => {
    const second = 'se\u0301cond';
    await render(
      inEdition(
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={[wordOf('fi\u0301rst'), wordOf(second)]}
            initialIndex={0}
            onIndexChange={jest.fn()}
            renderPage={(card) => <EntryCard card={card} stressFalls />}
            turnActionLabels={{ next: 'Next page', previous: 'Previous page' }}
          />
        </HapticsProvider>,
      ),
    );
    await fireEvent(screen.getByTestId('pager'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });
    await settle();
    await advance(SWIPE_MS);

    expect(marks(second).opacity).toBe(0);
  });

  it('keeps what VoiceOver reads of the Lemma while the mark falls', async () => {
    await render(inEdition(<EntryCard card={word} stressFalls />));
    await settle();

    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(screen.getByRole('header')).toHaveAccessibleName('catalog, stress on a');
    // The falling marks are drawn for the eye alone.
    expect(screen.getByTestId('word-lemma-falling', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('word-lemma-falling')).toBeNull();
  });

  it('shows the mark in place with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(inEdition(<EntryCard card={word} stressFalls />));
    await settle();

    expect(screen.queryByTestId('word-lemma-falling', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('word-lemma')).toHaveTextContent('catálog');
    expect(screen.getByRole('header')).toHaveAccessibleName('catalog, stress on a');
  });

  it('shows the mark in place on a card that is not to animate', async () => {
    await render(inEdition(<EntryCard card={word} />));
    await settle();

    expect(screen.queryByTestId('word-lemma-falling', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('word-lemma')).toHaveTextContent('catálog');
  });

  it('stays still in a list row', async () => {
    await render(
      <GestureHandlerRootView>{inEdition(<EntryRow row={row} />)}</GestureHandlerRootView>,
    );
    await settle();

    expect(screen.queryByTestId('word-lemma-falling', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('catálog')).toBeOnTheScreen();
  });

  it('stays still on a Share Card', async () => {
    const shared: EntryFeedCard = word;
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        {inEdition(
          <ShareSheet
            visible
            content={buildShareCardContent({ card: shared, todaysWordOfTheDay: false }, strings)}
            watermark="SLOVO"
            initialFormat="story"
            onFormatChange={jest.fn()}
            onShare={() => Promise.resolve('closed')}
            onClose={jest.fn()}
          />,
        )}
      </SafeAreaProvider>,
    );
    await settle();

    expect(screen.queryByTestId('word-lemma-falling', { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText('catálog', { includeHiddenElements: true }).length).toBeGreaterThan(
      0,
    );
  });
});
