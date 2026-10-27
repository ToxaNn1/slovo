import type { EditionStrings } from '@slovo/contracts';
import type { EntryRowModel } from '@slovo/core';
import { EditionProvider, EntryRow, type EntryRowAction } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const strings = { correctionCard: { insteadOf: 'instead of «{form}»' } } as EditionStrings;

const row: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'lemma',
  secondLine: 'what it means',
  labelKey: 'word',
  spoken: 'lemma, what it means',
  partOfSpeech: 'adjective',
  registers: [],
};

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c1',
  title: 'right',
  secondLine: 'wrong',
  labelKey: 'correction',
  spoken: 'right, wrong',
  correctionType: 'calque',
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
  Pick<ComponentProps<typeof EntryRow>, 'row' | 'onPress' | 'actions' | 'leading' | 'compact'>
> = {}) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EntryRow row={shown} trailing="12:30" {...props} />
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

  it('puts the leading text before the title, a dot between, and reads it first', async () => {
    await renderRow({ leading: '26 October', compact: true });

    expect(screen.getByLabelText('26 October, lemma, 12:30')).toHaveTextContent(
      '26 October · lemma12:30',
    );
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

  it('runs an action from behind the swipe', async () => {
    const onDelete = jest.fn();
    await renderRow({ onPress: jest.fn(), actions: [deleteAction(onDelete)] });

    await fireEvent.press(screen.getByTestId('entry-row-w1-delete'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('offers its actions to VoiceOver', async () => {
    const onDelete = jest.fn();
    await renderRow({ onPress: jest.fn(), actions: [deleteAction(onDelete)] });

    await fireEvent(screen.getByTestId('entry-row-w1-open'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
