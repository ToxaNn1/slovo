import type { GridCell, RoundAnswer, RoundOption } from '@slovo/core';
import { coreTokens, EditionProvider, PairsGrid } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

type PairsAnswer = Extract<RoundAnswer, { form: 'pairs' }>;

const strings = testStrings({
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or' },
});

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

const { accent, ink, surfaceSunken, tile } = coreTokens.colors.light;

/** The face of a cell, which turns ink, red or sinks. */
const face = (testID: string) => screen.getByTestId(`${testID}-face`);

/** What pops, drops or turns a cell now. */
function motionOf(testID: string) {
  const { opacity, transform } = getAnimatedStyle(screen.getByTestId(`${testID}-motion`)) as {
    opacity?: number;
    transform?: { translateX?: number; translateY?: number; scale?: number; rotate?: string }[];
  };
  const step = <K extends 'translateX' | 'translateY' | 'scale' | 'rotate'>(key: K) =>
    transform?.find((one) => one[key] !== undefined)?.[key];
  return {
    opacity,
    scale: step('scale'),
    translateX: step('translateX'),
    translateY: step('translateY'),
    rotate: step('rotate'),
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('PairsGrid', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
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

  it('turns the selected Word ink', async () => {
    await renderGrid();
    expect(face('pairs-word-0')).toHaveStyle({ backgroundColor: tile });

    await fireEvent.press(word(0));

    expect(face('pairs-word-0')).toHaveStyle({ backgroundColor: ink });
    expect(face('pairs-word-1')).toHaveStyle({ backgroundColor: tile });
  });

  it('sinks a wrong pair, drops it and turns its Word left and its Definition right', async () => {
    await renderGrid();

    await match(0, 2);
    await wait(1000);

    expect(face('pairs-word-0')).toHaveStyle({ backgroundColor: surfaceSunken });
    expect(face('pairs-definition-2')).toHaveStyle({ backgroundColor: surfaceSunken });
    expect(motionOf('pairs-word-0')).toMatchObject({
      translateY: 8,
      rotate: '-3deg',
      opacity: 0.6,
    });
    expect(motionOf('pairs-definition-2')).toMatchObject({
      translateY: 8,
      rotate: '3deg',
      opacity: 0.6,
    });
    expect(motionOf('pairs-word-0').translateX).toBeUndefined();
    expect(face('pairs-word-1')).toHaveStyle({ backgroundColor: tile });
    expect(motionOf('pairs-word-1')).toMatchObject({ opacity: 1, translateY: undefined });
  });

  it('turns a right pair red and pops it', async () => {
    await renderGrid();

    await match(0, 1);
    await wait(150);
    expect(motionOf('pairs-definition-1').scale).not.toBe(1);
    await wait(1000);

    expect(face('pairs-word-0')).toHaveStyle({ backgroundColor: accent });
    expect(face('pairs-definition-1')).toHaveStyle({ backgroundColor: accent });
    expect(motionOf('pairs-definition-1')).toMatchObject({ scale: 1, translateX: undefined });
    expect(face('pairs-definition-0')).toHaveStyle({ backgroundColor: tile });
  });

  describe('with Reduce Motion', () => {
    beforeEach(() => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    });

    it('turns a right pair red in place, popping nothing', async () => {
      await renderGrid();

      await match(0, 1);
      for (const ms of [100, 100, 600]) {
        await wait(ms);
        expect(motionOf('pairs-word-0').scale).toBeUndefined();
      }

      expect(face('pairs-word-0')).toHaveStyle({ backgroundColor: accent });
    });

    it('sinks a wrong pair in place, dropping and turning nothing', async () => {
      await renderGrid();

      await match(0, 2);
      for (const ms of [100, 100, 600]) {
        await wait(ms);
        expect(motionOf('pairs-word-0')).toMatchObject({
          translateY: undefined,
          rotate: undefined,
        });
      }

      expect(face('pairs-word-0')).toHaveStyle({ backgroundColor: surfaceSunken });
      expect(motionOf('pairs-word-0').opacity).toBe(0.6);
    });
  });

  it('names each Word with its Stress and each Definition by its text for VoiceOver', async () => {
    await renderGrid();

    expect(word(0)).toHaveAccessibleName('virii, stress on i');
    expect(word(1)).toHaveAccessibleName('obrok');
    expect(screen.getByRole('button', { name: 'a small oil lamp' })).toBe(definition(2));
  });
});
