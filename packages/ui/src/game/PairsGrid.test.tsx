import type { EditionStrings } from '@slovo/contracts';
import type { GridCell, RoundAnswer, RoundOption } from '@slovo/core';
import { EditionProvider, PairsGrid } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

type PairsAnswer = Extract<RoundAnswer, { form: 'pairs' }>;

const strings = {
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or' },
} as unknown as EditionStrings;

/** The grid's Words in the order shown, and the place of each one's Definition among the Definitions. */
const WORDS: readonly RoundOption[] = [
  { text: 'vírii', stressedVowels: ['i'] },
  { text: 'obrok', stressedVowels: [] },
  { text: 'kaganets', stressedVowels: [] },
  { text: 'kraquelure', stressedVowels: [] },
];
const DEFINITIONS = [
  'fine cracks in the paint of an old picture',
  'the warm lands where the birds fly off to for the winter',
  'a small oil lamp',
  'a vow',
] as const;
const OWN_DEFINITION = [1, 3, 2, 0] as const;

/**
 * A pairs grid played as the Game plays it: a Round per pair, judged as the
 * Game in play judges it, and «Далі» bringing the next Round with the pairs
 * answered right gone.
 */
function Grid({ onAnswer }: { onAnswer: (word: number, definition: number) => void }) {
  const [gone, setGone] = useState<readonly number[]>([]);
  const [round, setRound] = useState(1);
  const [answer, setAnswer] = useState<PairsAnswer>();
  const words: GridCell<RoundOption>[] = WORDS.map((shown, word) => ({
    shown,
    gone: gone.includes(word),
  }));
  const definitions: GridCell<string>[] = DEFINITIONS.map((shown, definition) => ({
    shown,
    gone: gone.some((word) => OWN_DEFINITION[word] === definition),
  }));
  return (
    <>
      <PairsGrid
        key={round}
        words={words}
        definitions={definitions}
        answer={answer}
        onAnswer={(word, definition) => {
          onAnswer(word, definition);
          const correct = OWN_DEFINITION[word] ?? -1;
          const pair = WORDS[word] ?? { text: '', stressedVowels: [] };
          setAnswer({
            form: 'pairs',
            word,
            definition,
            correct,
            right: definition === correct,
            sheet: { answer: pair, example: undefined },
          });
        }}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (answer?.right === true) setGone([...gone, answer.word]);
          setAnswer(undefined);
          setRound(round + 1);
        }}
      >
        <Text>next</Text>
      </Pressable>
    </>
  );
}

async function renderGrid(onAnswer: (word: number, definition: number) => void = jest.fn()) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <Grid onAnswer={onAnswer} />
    </EditionProvider>,
  );
}

const word = (place: number) => screen.getByTestId(`pairs-word-${String(place)}`);
const definition = (place: number) => screen.getByTestId(`pairs-definition-${String(place)}`);

async function match(wordPlace: number, definitionPlace: number) {
  await fireEvent.press(word(wordPlace));
  await fireEvent.press(definition(definitionPlace));
}

async function next() {
  await fireEvent.press(screen.getByRole('button', { name: 'next' }));
}

/** The horizontal shift of a cell. */
function shiftOf(testID: string): number {
  const style = getAnimatedStyle(screen.getByTestId(testID)) as {
    transform?: { translateX?: number }[];
  };
  return style.transform?.find((step) => step.translateX !== undefined)?.translateX ?? 0;
}

describe('PairsGrid', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('selects the Word tapped, one at a time', async () => {
    await renderGrid();

    await fireEvent.press(word(0));
    expect(word(0)).toBeSelected();

    await fireEvent.press(word(2));
    expect(word(2)).toBeSelected();
    expect(word(0)).not.toBeSelected();

    await fireEvent.press(word(2));
    expect(word(2)).not.toBeSelected();
  });

  it('matches nothing when a Definition is tapped before a Word', async () => {
    const onAnswer = jest.fn();
    await renderGrid(onAnswer);

    await fireEvent.press(definition(1));

    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('gives the pair with the Definition tapped after a Word', async () => {
    const onAnswer = jest.fn();
    await renderGrid(onAnswer);

    await match(0, 1);

    expect(onAnswer).toHaveBeenCalledWith(0, 1);
    // The answered Round waits for «Далі»: no cell takes a tap.
    expect(word(1)).toBeDisabled();
    expect(definition(0)).toBeDisabled();
  });

  it('takes a right pair out of the grid in the next Round', async () => {
    await renderGrid();

    await match(0, 1);
    await next();

    // The pair leaves its places empty, which VoiceOver skips.
    expect(screen.queryByTestId('pairs-word-0')).toBeNull();
    expect(screen.queryByTestId('pairs-definition-1')).toBeNull();
    expect(screen.getByTestId('pairs-word-0', { includeHiddenElements: true })).toBeDisabled();
    expect(word(1)).toBeEnabled();
    expect(definition(0)).toBeEnabled();
  });

  it('leaves a wrong pair in the grid with nothing selected', async () => {
    await renderGrid();

    await match(0, 2);
    expect(word(0)).not.toBeSelected();
    await next();

    expect(word(0)).toBeEnabled();
    expect(word(0)).not.toBeSelected();
    expect(definition(2)).toBeEnabled();
  });

  it('shakes the Word and the Definition of a wrong pair', async () => {
    await renderGrid();

    await match(0, 2);
    await act(() => {
      jest.advanceTimersByTime(80);
    });

    expect(shiftOf('pairs-word-0')).toBe(-4);
    expect(shiftOf('pairs-definition-2')).toBe(-4);
    expect(shiftOf('pairs-word-1')).toBe(0);
  });

  it('shakes nothing of a right pair', async () => {
    await renderGrid();

    await match(0, 1);
    await act(() => {
      jest.advanceTimersByTime(80);
    });

    expect(shiftOf('pairs-word-0')).toBe(0);
    expect(shiftOf('pairs-definition-1')).toBe(0);
  });

  it('shakes nothing with Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderGrid();

    await match(0, 2);
    await act(() => {
      jest.advanceTimersByTime(80);
    });

    expect(shiftOf('pairs-word-0')).toBe(0);
  });

  it('names each Word with its Stress and each Definition by its text for VoiceOver', async () => {
    await renderGrid();

    expect(word(0)).toHaveAccessibleName('virii, stress on i');
    expect(word(1)).toHaveAccessibleName('obrok');
    expect(screen.getByRole('button', { name: 'a small oil lamp' })).toBe(definition(2));
  });
});
