import type { CollectionEntry, EntryRowModel } from '@slovo/core';
import { CollectionEntryRow, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { testStrings } from '../test-strings';

const strings = testStrings({
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
    kindBeside: '{kind} · {time}',
  },
  collections: { entries: { remove: 'Remove', removeLabel: 'Remove «{title}» from «{name}»' } },
  correctionCard: { insteadOf: 'instead of {form}' },
});

const word: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'ríver',
  secondLine: 'what river means',
  labelKey: 'word',
  spoken: 'river, what river means',
  partOfSpeech: 'noun',
  registers: [],
};

const idiom = (labelKey: 'idiom' | 'placeName'): EntryRowModel => ({
  kind: 'idiom',
  entryId: 'i1',
  title: 'spill the beans',
  secondLine: 'To give away a secret.',
  labelKey,
  spoken: 'spill the beans, To give away a secret.',
});

const synonymRow: EntryRowModel = {
  kind: 'synonymRow',
  entryId: 'r1',
  title: 'wálk',
  secondLine: 'To move on foot.',
  labelKey: 'synonymRow',
  spoken: 'walk, To move on foot.',
};

const tip: EntryRowModel = {
  kind: 'tip',
  entryId: 't1',
  title: 'What time is it?',
  secondLine: 'What time is it now?',
  labelKey: 'tip',
  spoken: 'What time is it?, What time is it now?',
};

const filed = (row: EntryRowModel): CollectionEntry => ({
  entryId: row.entryId,
  row,
  addedAt: new Date('2026-10-13T09:00:00Z'),
});

async function renderRow(row: EntryRowModel, { onPress = jest.fn(), onRemove = jest.fn() } = {}) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <CollectionEntryRow
          entry={filed(row)}
          added="today"
          collectionName="Rivers"
          onPress={onPress}
          onRemove={onRemove}
        />
      </EditionProvider>
    </GestureHandlerRootView>,
  );
}

describe('CollectionEntryRow', () => {
  it('shows the Entry with its kind beside when it was added', async () => {
    await renderRow(word);

    expect(screen.getByText('ríver')).toBeTruthy();
    expect(screen.getByText('what river means')).toBeTruthy();
    expect(screen.getByText('word · today')).toBeTruthy();
  });

  it.each<['idiom' | 'placeName', string]>([
    ['idiom', 'idiom · today'],
    ['placeName', 'place name · today'],
  ])('labels an Idiom by its Idiom Type, %s', async (labelKey, trailing) => {
    await renderRow(idiom(labelKey));

    expect(screen.getByText('spill the beans')).toBeTruthy();
    expect(screen.getByText(trailing)).toBeTruthy();
  });

  it.each([
    ['a Synonym Row by its dominant', synonymRow, 'wálk', 'To move on foot.', 'synonyms · today'],
    ['a Tip by its title', tip, 'What time is it?', 'What time is it now?', 'tip · today'],
  ])('shows %s, with its kind, and opens it on a tap', async (_, row, title, line, trailing) => {
    const onPress = jest.fn();
    await renderRow(row, { onPress });

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(line)).toBeTruthy();
    expect(screen.getByText(trailing)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`entry-row-${row.entryId}-open`));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('opens the Entry on a tap', async () => {
    const onPress = jest.fn();
    await renderRow(word, { onPress });

    await fireEvent.press(screen.getByTestId('entry-row-w1-open'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('takes the Entry out of the Collection by its VoiceOver action, named without the Stress mark', async () => {
    const onRemove = jest.fn();
    await renderRow(word, { onRemove });

    const row = screen.getByTestId('entry-row-w1-open');
    expect(row.props['accessibilityActions']).toEqual([
      { name: 'remove', label: 'Remove «river» from «Rivers»' },
    ]);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'remove' } });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
