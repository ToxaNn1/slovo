import { DeleteCollectionDialog, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const copy = {
  title: 'Delete the Collection “{name}”?',
  message: 'The Entries stay.',
  confirm: 'Delete',
  cancel: 'Cancel',
};

async function renderDialog(name?: string) {
  const onDelete = jest.fn();
  const onCancel = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <DeleteCollectionDialog
        name={name}
        copy={copy}
        onDelete={onDelete}
        onCancel={onCancel}
        testID="collections-delete"
      />
    </EditionProvider>,
  );
  return { onDelete, onCancel };
}

describe('DeleteCollectionDialog', () => {
  it('names the Collection and says its Entries stay', async () => {
    await renderDialog('Charlie');

    expect(screen.getByText('Delete the Collection “Charlie”?')).toBeOnTheScreen();
    expect(screen.getByText('The Entries stay.')).toBeOnTheScreen();
  });

  it('shows nothing while no Collection is asked about', async () => {
    await renderDialog();

    expect(screen.queryByText('The Entries stay.')).not.toBeOnTheScreen();
  });

  it('deletes when the reader confirms', async () => {
    const { onDelete, onCancel } = await renderDialog('Charlie');

    await fireEvent.press(screen.getByTestId('collections-delete-destructive'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('keeps the Collection when the reader cancels', async () => {
    const { onDelete, onCancel } = await renderDialog('Charlie');

    await fireEvent.press(screen.getByTestId('collections-delete-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
