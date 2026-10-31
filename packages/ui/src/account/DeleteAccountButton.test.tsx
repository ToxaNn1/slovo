import { DeleteAccountButton, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const copy = {
  button: 'Delete SLOVO ID',
  title: 'Delete SLOVO ID?',
  message: 'Your data goes with it.',
  confirm: 'Delete',
  cancel: 'Cancel',
};

async function renderButton(props: { busy?: boolean; disabled?: boolean } = {}) {
  const onDelete = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <DeleteAccountButton copy={copy} onDelete={onDelete} testID="account-delete" {...props} />
    </EditionProvider>,
  );
  return { onDelete };
}

describe('DeleteAccountButton', () => {
  it('asks before it deletes and shows no dialog until pressed', async () => {
    const { onDelete } = await renderButton();

    expect(screen.queryByText('Delete SLOVO ID?')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete SLOVO ID' }));

    expect(screen.getByText('Delete SLOVO ID?')).toBeOnTheScreen();
    expect(screen.getByText('Your data goes with it.')).toBeOnTheScreen();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('deletes when the reader confirms, and closes the dialog', async () => {
    const { onDelete } = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete SLOVO ID' }));

    await fireEvent.press(screen.getByTestId('account-delete-dialog-destructive'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Delete SLOVO ID?')).not.toBeOnTheScreen();
  });

  it('deletes nothing when the reader cancels, and closes the dialog', async () => {
    const { onDelete } = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete SLOVO ID' }));

    await fireEvent.press(screen.getByTestId('account-delete-dialog-cancel'));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete SLOVO ID?')).not.toBeOnTheScreen();
  });

  it('takes no press while disabled', async () => {
    await renderButton({ disabled: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Delete SLOVO ID' }));

    expect(screen.queryByText('Delete SLOVO ID?')).not.toBeOnTheScreen();
  });
});
