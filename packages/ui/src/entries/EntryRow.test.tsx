import type { EntryRowModel } from '@slovo/core';
import { EditionProvider, EntryRow, type EntryRowAction } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { testStrings } from '../test-strings';

const strings = testStrings({ correctionCard: { insteadOf: 'instead of «{form}»' } });

const row: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'lemma',
  secondLine: 'what it means',
  labelKey: 'word',
  spoken: 'lemma, what it means',
  partOfSpeech: 'adjective',
  gender: undefined,
  registers: [],
  rarity: 3,
};

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c1',
  title: 'right',
  secondLine: 'wrong',
  labelKey: 'correction',
  spoken: 'right, wrong',
  correctionType: 'calque',
  standardForms: ['right'],
};

const idiom: EntryRowModel = {
  kind: 'idiom',
  entryId: 'i1',
  title: 'spill the beans',
  secondLine: 'to give away a secret',
  labelKey: 'idiom',
  spoken: 'spill the beans, to give away a secret',
};

function deleteAction(onPress: () => void): EntryRowAction {
  return {
    name: 'delete',
    label: 'Delete',
    accessibilityLabel: 'Delete lemma',
    tone: 'destructive',
    onPress,
  };
}

async function renderRow({
  row: shown = row,
  ...props
}: Partial<
  Pick<ComponentProps<typeof EntryRow>, 'row' | 'onPress' | 'actions' | 'day' | 'trailing'>
> = {}) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EntryRow
          row={shown}
          {...(props.day === undefined ? { trailing: '12:30' } : {})}
          {...props}
        />
      </EditionProvider>
    </GestureHandlerRootView>,
  );
}

describe('EntryRow', () => {
  it('opens the Entry on a tap and reads its title, Definition and trailing text', async () => {
    const onPress = jest.fn();
    await renderRow({ onPress });

    await fireEvent.press(screen.getByRole('button', { name: 'lemma, what it means, 12:30' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('puts the day on a chip on the right and reads it after the meaning', async () => {
    await renderRow({ day: { label: 'yesterday', today: false } });

    expect(screen.getByLabelText('lemma, what it means, yesterday')).toHaveTextContent(
      'lemmawhat it meansyesterday',
    );
  });

  it('draws today’s chip in the accent colour and any other day’s sunken', async () => {
    await renderRow({ day: { label: 'today', today: true } });
    expect(screen.getByTestId('entry-row-w1-day')).toHaveStyle({ backgroundColor: '#161616' });
    expect(screen.getByText('today')).toHaveStyle({ color: '#FFFFFF' });

    await renderRow({ day: { label: '30 Oct', today: false } });
    expect(screen.getByTestId('entry-row-w1-day')).toHaveStyle({ backgroundColor: '#EFEFEC' });
  });

  it('lets the meaning wrap beside a day chip', async () => {
    await renderRow({ day: { label: 'today', today: true } });

    expect(screen.getByText('what it means').props['numberOfLines']).toBeUndefined();
  });

  it('puts the form a Correction replaces under its standard equivalent', async () => {
    await renderRow({ row: correction });

    expect(screen.getByLabelText('right, instead of «wrong», 12:30')).toBeTruthy();
    expect(screen.getByText('instead of «wrong»')).toBeTruthy();
  });

  it('puts the Definition under an Idiom and reads both to VoiceOver', async () => {
    await renderRow({ row: idiom });

    expect(screen.getByLabelText('spill the beans, to give away a secret, 12:30')).toBeTruthy();
    expect(screen.getByText('to give away a secret')).toBeTruthy();
  });

  it('offers its actions to VoiceOver', async () => {
    const onDelete = jest.fn();
    await renderRow({ onPress: jest.fn(), actions: [deleteAction(onDelete)] });

    await fireEvent(screen.getByTestId('entry-row-w1-open'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps the buttons behind the row away from VoiceOver, which reaches them as the row’s actions', async () => {
    await renderRow({ onPress: jest.fn(), actions: [deleteAction(jest.fn())] });

    expect(screen.getByTestId('entry-row-w1-delete', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('entry-row-w1-delete')).toBeNull();
  });
});
