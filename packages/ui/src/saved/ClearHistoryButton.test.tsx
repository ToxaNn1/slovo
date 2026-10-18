import type { EditionStrings } from '@slovo/contracts';
import { ClearHistoryButton, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

const copy = {
  action: 'Clear',
  actionLabel: 'Clear History',
  title: 'Clear History?',
  message: 'Favorites and Collections stay.',
  confirm: 'Clear',
  cancel: 'Cancel',
};

async function renderButton() {
  const onClear = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
      <ClearHistoryButton copy={copy} onClear={onClear} testID="history-clear" />
    </EditionProvider>,
  );
  return { onClear };
}

describe('ClearHistoryButton', () => {
  it('asks before it clears and shows no dialog until pressed', async () => {
    const { onClear } = await renderButton();

    expect(screen.queryByText('Clear History?')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear History' }));

    expect(screen.getByText('Clear History?')).toBeOnTheScreen();
    expect(screen.getByText('Favorites and Collections stay.')).toBeOnTheScreen();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('clears when the reader confirms, and closes the dialog', async () => {
    const { onClear } = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear History' }));

    await fireEvent.press(screen.getByTestId('history-clear-dialog-destructive'));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Clear History?')).not.toBeOnTheScreen();
  });

  it('clears nothing when the reader cancels, and closes the dialog', async () => {
    const { onClear } = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear History' }));

    await fireEvent.press(screen.getByTestId('history-clear-dialog-cancel'));

    expect(onClear).not.toHaveBeenCalled();
    expect(screen.queryByText('Clear History?')).not.toBeOnTheScreen();
  });
});
