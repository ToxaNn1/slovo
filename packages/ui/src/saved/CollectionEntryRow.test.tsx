import type { EditionStrings } from '@slovo/contracts';
import type { CollectionEntry, EntryRowModel } from '@slovo/core';
import { CollectionEntryRow, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const strings = {
  history: {
    kinds: {
      word: 'word',
      correction: 'correction',
      wordOfTheDay: 'word of the day',
      idiom: 'idiom',
      placeName: 'place name',
    },
    kindBeside: '{kind} · {time}',
  },
  collections: { entries: { remove: 'Remove', removeLabel: 'Remove «{title}» from «{name}»' } },
  correctionCard: { insteadOf: 'instead of {form}' },
} as EditionStrings;

const word: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'ríver',
  secondLine: 'what river means',
  kindKey: 'word',
  spoken: 'river, what river means',
  partOfSpeech: 'noun',
  registers: [],
};

const idiom = (kindKey: 'idiom' | 'placeName'): EntryRowModel => ({
  kind: 'idiom',
  entryId: 'i1',
  title: 'spill the beans',
  secondLine: 'To give away a secret.',
  kindKey,
  spoken: 'spill the beans, To give away a secret.',
});

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
  ])('names an Idiom’s kind by its Idiom Type, %s', async (kindKey, trailing) => {
    await renderRow(idiom(kindKey));

    expect(screen.getByText('spill the beans')).toBeTruthy();
    expect(screen.getByText(trailing)).toBeTruthy();
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
