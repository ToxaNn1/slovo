import type { WordFeedCard } from '@slovo/core';
import { EditionProvider, EntryCard, ReduceMotionProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
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

async function renderCard(reduceMotion: boolean) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <EntryCard card={card} actions={<Text>Actions</Text>} />
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

  it('flies the Lemma in letter by letter, then raises the details after it', async () => {
    await renderCard(false);

    // Every letter but the spaces flies on its own, from below and unseen.
    expect(screen.getByTestId('word-lemma-letter-4', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('word-lemma-letter-5', { includeHiddenElements: true })).toBeNull();
    expect(styleOf('word-lemma-letter-0').opacity).toBe(0);
    expect(styleOf('word-actions').opacity).toBe(0);

    // The first letter is on its way while the last still waits its turn.
    await wait(120 + 100);
    expect(styleOf('word-lemma-letter-0').opacity).toBeGreaterThan(0);
    expect(styleOf('word-lemma-letter-4').opacity).toBe(0);
    expect(styleOf('word-actions').opacity).toBe(0);

    await wait(900 + 400 - 220);
    expect(styleOf('word-lemma-letter-4').opacity).toBeCloseTo(1);
    expect(styleOf('word-lemma-letter-4').rise).toBeCloseTo(0);
    expect(styleOf('word-actions').opacity).toBeCloseTo(1);
    expect(styleOf('word-actions').rise).toBeCloseTo(0);
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('under Reduce Motion fades the card in once and moves nothing', async () => {
    await renderCard(true);

    expect(screen.queryByTestId('word-lemma-letter-0', { includeHiddenElements: true })).toBeNull();
    expect(styleOf('word-actions')).toEqual({ opacity: 1, rise: 0 });
    expect(styleOf('word-card').opacity).toBeLessThan(1);

    await wait(300);
    expect(styleOf('word-card').opacity).toBeCloseTo(1);
    expect(screen.getByText('lemma')).toBeTruthy();
  });
});
