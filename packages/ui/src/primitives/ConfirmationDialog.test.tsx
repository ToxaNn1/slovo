import { ConfirmationDialog, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

async function renderDialog(props: Partial<Parameters<typeof ConfirmationDialog>[0]> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <ConfirmationDialog
        visible
        title="Clear History?"
        message="Every viewed word leaves the list."
        destructiveLabel="Clear"
        cancelLabel="Cancel"
        onDestructive={onConfirm}
        onCancel={onCancel}
        testID="dialog"
        {...props}
      />
    </EditionProvider>,
  );
  return { onConfirm, onCancel };
}

describe('ConfirmationDialog', () => {
  it('says what is asked and offers the two actions', async () => {
    await renderDialog();

    expect(screen.getByRole('header', { name: 'Clear History?' })).toBeOnTheScreen();
    expect(screen.getByText('Every viewed word leaves the list.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('confirms with the destructive action alone', async () => {
    const { onConfirm, onCancel } = await renderDialog();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes on cancel without confirming', async () => {
    const { onConfirm, onCancel } = await renderDialog();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on a tap beside the dialog and on the system back gesture', async () => {
    const { onConfirm, onCancel } = await renderDialog();

    await fireEvent.press(screen.getByTestId('dialog-scrim', { includeHiddenElements: true }));
    await fireEvent(screen.getByTestId('dialog'), 'requestClose');

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('is modal for VoiceOver and leaves out the scrim', async () => {
    await renderDialog();

    expect(screen.getByTestId('dialog-panel')).toHaveProp('accessibilityViewIsModal', true);
    expect(screen.getByTestId('dialog-scrim', { includeHiddenElements: true })).toHaveProp(
      'accessible',
      false,
    );
  });

  it('draws nothing while it is not visible', async () => {
    await renderDialog({ visible: false });

    expect(screen.queryByText('Clear History?')).toBeNull();
  });

  it('shows no message line when there is no message', async () => {
    await renderDialog({ message: undefined });

    expect(screen.queryByTestId('dialog-message')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeOnTheScreen();
  });
});
