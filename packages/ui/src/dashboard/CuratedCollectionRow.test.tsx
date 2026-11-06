import type { EntryRowModel } from '@slovo/core';
import { CuratedCollectionRow, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
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
  correctionCard: { insteadOf: 'instead of {form}' },
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
};

async function renderRow(row: EntryRowModel, known: boolean) {
  const onPress = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
      <CuratedCollectionRow testID="row" row={row} known={known} onPress={onPress} />
    </EditionProvider>,
  );
  return onPress;
}

describe('CuratedCollectionRow', () => {
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

  it('labels another Entry by its kind, with what it replaces', async () => {
    await renderRow(correction, false);

    expect(screen.getByText('correction')).toBeTruthy();
    expect(screen.getByText('instead of shoby')).toBeTruthy();
  });
});
