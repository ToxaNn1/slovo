import type { EditionStrings } from '@slovo/contracts';
import type { EntryRowModel } from '@slovo/core';
import { EditionProvider, EntryRow, type EntryRowAction } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const row: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'lemma',
  definition: 'what it means',
  partOfSpeech: 'adjective',
  registers: [],
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

async function renderRow(props: Pick<ComponentProps<typeof EntryRow>, 'onPress' | 'actions'>) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en', categories: [] }} strings={{} as EditionStrings}>
        <EntryRow row={row} trailing="12:30" {...props} />
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
