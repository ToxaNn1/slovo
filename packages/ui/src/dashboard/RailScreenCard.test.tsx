import type { EntryRowModel } from '@slovo/core';
import { EditionProvider, RailScreenCard, ReduceMotionProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const strings = testStrings({
  knowledge: { known: 'Known' },
  history: {
    kinds: {
      word: 'word',
      correction: 'correction',
      wordOfTheDay: 'word of the day',
      idiom: 'idiom',
      placeName: 'place name',
      proverb: 'proverb',
      synonymRow: 'synonyms',
      tip: 'tip',
    },
  },
  correctionCard: { insteadOf: 'instead of {form}', correctionTypes: { surzhyk: 'Surzhyk' } },
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: { feminine: { short: 'f.', full: 'feminine' } },
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
  },
});

const word: EntryRowModel = {
  kind: 'word',
  entryId: 'w_harbour',
  title: 'hárbour',
  secondLine: 'A safe place for ships.',
  labelKey: 'word',
  spoken: 'harbour, A safe place for ships.',
  partOfSpeech: 'noun',
  gender: 'feminine',
  registers: [],
  rarity: 4,
};

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c_shoby',
  title: 'shchob',
  secondLine: 'shoby',
  labelKey: 'correction',
  spoken: 'shchob, instead of shoby',
  correctionType: 'surzhyk',
  standardForms: ['shchob', 'aby'],
};

const idiom: EntryRowModel = {
  kind: 'idiom',
  entryId: 'i_cats',
  title: 'raining cats and dogs',
  secondLine: 'Raining very hard.',
  labelKey: 'idiom',
  spoken: 'raining cats and dogs, Raining very hard.',
};

async function renderRow(
  row: EntryRowModel,
  known: boolean,
  { index = 0, reduceMotion = false }: { index?: number; reduceMotion?: boolean } = {},
) {
  const onPress = jest.fn();
  await render(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
        <RailScreenCard testID="row" row={row} known={known} index={index} onPress={onPress} />
      </EditionProvider>
    </ReduceMotionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return onPress;
}

function cascade() {
  const style = getAnimatedStyle(screen.getByTestId('row-cascade')) as {
    opacity?: number;
    transform?: { translateY?: number }[];
  };
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

describe('RailScreenCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shows a Word’s Lemma, its Stress and part of speech and its Definition, and a tap opens it', async () => {
    const onPress = await renderRow(word, false);

    expect(screen.getByText('harbour')).toBeTruthy();
    expect(screen.getByText('hárbour · n., f.')).toBeTruthy();
    expect(screen.getByText('A safe place for ships.')).toBeTruthy();
    expect(screen.queryByTestId('row-known')).toBeNull();

    await fireEvent.press(screen.getByLabelText('harbour, A safe place for ships.'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stamps a Known Entry «Known» and reads it', async () => {
    await renderRow(word, true);

    expect(screen.getByTestId('row-known')).toHaveTextContent('Known');
    expect(screen.getByLabelText(/^harbour, A safe place for ships\..* Known$/)).toBeTruthy();
  });

  it('draws a Correction as its non-standard form, its Correction Type without bars and its standard forms', async () => {
    await renderRow(correction, false);

    expect(screen.getByText('shoby')).toBeTruthy();
    expect(screen.getByText('Surzhyk')).toBeTruthy();
    expect(screen.getByText('shchob · aby')).toBeTruthy();
    expect(screen.queryAllByTestId(/^row-bar-/)).toEqual([]);
    expect(screen.queryByTestId('row-known')).toBeNull();
  });

  it('stamps a Known Correction «Known»', async () => {
    await renderRow(correction, true);

    expect(screen.getByTestId('row-known')).toHaveTextContent('Known');
  });

  it('shows a Correction’s one standard form alone', async () => {
    await renderRow({ ...correction, standardForms: ['aby'] }, false);

    expect(screen.getByText('aby')).toBeTruthy();
    expect(screen.queryByText(/ · /)).toBeNull();
  });

  it('draws a Word’s five rarity bars, as many filled as its rarity', async () => {
    await renderRow(word, true);

    const bars = screen.getAllByTestId(/^row-bar-/);
    expect(bars).toHaveLength(5);
    expect(screen.getAllByTestId(/^row-bar-\d-filled$/)).toHaveLength(4);
    expect(screen.getByTestId('row-known')).toHaveTextContent('Known');
  });

  it('draws another Entry with its title and meaning and no bars', async () => {
    await renderRow(idiom, false);

    expect(screen.getByText('raining cats and dogs')).toBeTruthy();
    expect(screen.getByText('Raining very hard.')).toBeTruthy();
    expect(screen.queryAllByTestId(/^row-bar-/)).toHaveLength(0);
  });

  it('rises in after the cards before it, 70 ms apart', async () => {
    await renderRow(word, false, { index: 2 });

    expect(cascade()).toEqual({ opacity: 0, rise: 16 });

    await wait(140);
    expect(cascade()).toEqual({ opacity: 0, rise: 16 });

    await wait(450);
    expect(cascade()).toEqual({ opacity: 1, rise: 0 });
  });

  it('only fades in under Reduce Motion, at once and without rising', async () => {
    await renderRow(word, false, { index: 2, reduceMotion: true });

    expect(cascade()).toEqual({ opacity: 0, rise: 0 });

    await wait(300);
    expect(cascade()).toEqual({ opacity: 1, rise: 0 });
  });
});
