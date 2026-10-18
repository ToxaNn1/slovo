import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, HideChoiceSheet } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const options = [
  { key: 'entry', label: 'Hide this Entry' },
  { key: 'category', label: 'Hide the Category “Nature”' },
];

async function renderSheet(visible = true) {
  const onChoose = jest.fn();
  const onCancel = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
        <HideChoiceSheet
          visible={visible}
          options={options}
          cancelLabel="Cancel"
          onChoose={onChoose}
          onCancel={onCancel}
        />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onChoose, onCancel };
}

describe('HideChoiceSheet', () => {
  it('offers a row per option and the cancel row last', async () => {
    await renderSheet();

    expect(screen.getByText('Hide this Entry')).toBeOnTheScreen();
    expect(screen.getByText('Hide the Category “Nature”')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('shows nothing while it is not visible', async () => {
    await renderSheet(false);

    expect(screen.queryByText('Hide this Entry')).not.toBeOnTheScreen();
  });

  it('asks for the option the reader taps, and not to cancel', async () => {
    const { onChoose, onCancel } = await renderSheet();

    await fireEvent.press(screen.getByTestId('hide-choice-category'));

    expect(onChoose).toHaveBeenCalledWith('category');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('asks to cancel from the cancel row without choosing', async () => {
    const { onChoose, onCancel } = await renderSheet();

    await fireEvent.press(screen.getByTestId('hide-choice-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('asks to cancel from a tap beside the sheet', async () => {
    const { onChoose, onCancel } = await renderSheet();

    await fireEvent.press(screen.getByTestId('hide-choice-scrim'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });
});
