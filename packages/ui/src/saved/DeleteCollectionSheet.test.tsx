import { DeleteCollectionSheet, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const copy = {
  title: 'Delete «{name}»?',
  message: 'The Entries stay.',
  confirm: 'Delete',
  cancel: 'Cancel',
};

async function renderSheet(name: string | undefined) {
  const onDelete = jest.fn();
  const onCancel = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <DeleteCollectionSheet name={name} copy={copy} onDelete={onDelete} onCancel={onCancel} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onDelete, onCancel };
}

describe('DeleteCollectionSheet', () => {
  it('asks about the Collection by name on the plate and says its Entries stay', async () => {
    await renderSheet('Nature');

    expect(screen.getByText('Delete «Nature»?')).toBeOnTheScreen();
    expect(screen.getByText('The Entries stay.')).toBeOnTheScreen();
  });

  it('deletes on its button', async () => {
    const { onDelete, onCancel } = await renderSheet('Nature');

    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels on the cancel button', async () => {
    const { onDelete, onCancel } = await renderSheet('Nature');

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows nothing with no Collection to ask about', async () => {
    await renderSheet(undefined);

    expect(screen.queryByText('The Entries stay.')).toBeNull();
  });
});
