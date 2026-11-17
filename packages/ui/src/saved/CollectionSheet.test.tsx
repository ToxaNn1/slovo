import type { Collection } from '@slovo/core';
import { CollectionSheet, coreTokens, EditionProvider, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = testStrings({
  collections: {
    count: { one: '{count} word', other: '{count} words' },
    sheet: {
      title: 'To a collection',
      rowLabel: '{name}, {count}',
      newCollection: '+ New collection',
      namePlaceholder: 'Collection name',
      create: 'Create',
      done: 'Done',
      nameFailed: 'Could not keep it.',
    },
  },
});

function collection(id: string, name: string, count: number): Collection {
  return { id, name, count, createdAt: new Date('2026-11-01T10:00:00Z'), newestLemmas: [] };
}

type Create = (name: string) => Promise<string | undefined>;

function sheet({
  collections = [collection('c1', 'Essays', 1), collection('c2', 'Trips', 3)],
  filed = ['c2'],
  onToggle = jest.fn(),
  onCreate = jest.fn<Create>().mockResolvedValue(undefined),
  onClose = jest.fn(),
}: {
  collections?: readonly Collection[];
  filed?: readonly string[];
  onToggle?: (collectionId: string, filed: boolean) => void;
  onCreate?: Create;
  onClose?: () => void;
} = {}) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <TokensProvider tokens={coreTokens} colorScheme="light">
        <EditionProvider edition={{ locale: 'en' }} strings={strings}>
          <CollectionSheet
            visible
            entryTitle="hoop"
            collections={collections}
            isFiled={(id) => filed.includes(id)}
            onToggle={onToggle}
            onCreate={onCreate}
            onClose={onClose}
          />
        </EditionProvider>
      </TokensProvider>
    </SafeAreaProvider>
  );
}

describe('CollectionSheet', () => {
  it('lists each Collection as a checkbox with its count, checked where the Entry is filed', async () => {
    await render(sheet());

    expect(screen.getByText('hoop')).toBeOnTheScreen();
    const essays = screen.getByRole('checkbox', { name: 'Essays, 1 word' });
    const trips = screen.getByRole('checkbox', { name: 'Trips, 3 words' });
    expect(essays).not.toBeChecked();
    expect(trips).toBeChecked();
    // With Collections to pick, the name field waits for «+ New collection».
    expect(screen.queryByLabelText('Collection name')).not.toBeOnTheScreen();
  });

  it('files the Entry in an unchecked Collection and takes it out of a checked one', async () => {
    const onToggle = jest.fn();
    await render(sheet({ onToggle }));

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Essays, 1 word' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Trips, 3 words' }));

    expect(onToggle.mock.calls).toEqual([
      ['c1', true],
      ['c2', false],
    ]);
  });

  it('makes a new Collection from the name field, then closes the field', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue(undefined);
    await render(sheet({ onCreate }));

    await fireEvent.press(screen.getByRole('button', { name: '+ New collection' }));
    await fireEvent.changeText(screen.getByLabelText('Collection name'), 'Poems');
    await fireEvent.press(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).toHaveBeenCalledWith('Poems');
    expect(screen.queryByLabelText('Collection name')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '+ New collection' })).toBeOnTheScreen();
  });

  it('opens the name field at once with no Collections, and keeps the name a refusal answers', async () => {
    const onCreate = jest.fn<Create>().mockResolvedValue('That name is taken.');
    await render(sheet({ collections: [], onCreate }));

    const field = screen.getByLabelText('Collection name');
    await fireEvent.changeText(field, 'Essays');
    await fireEvent(field, 'submitEditing');

    expect(onCreate).toHaveBeenCalledWith('Essays');
    expect(screen.getByTestId('collection-refusal')).toHaveTextContent('That name is taken.');
    expect(screen.getByLabelText('Collection name')).toHaveDisplayValue('Essays');
    await fireEvent.changeText(screen.getByLabelText('Collection name'), 'Essays 2');
    expect(screen.queryByTestId('collection-refusal')).not.toBeOnTheScreen();
  });

  it('closes on «Done» without filing anything', async () => {
    const onClose = jest.fn();
    const onToggle = jest.fn();
    await render(sheet({ onClose, onToggle }));

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
