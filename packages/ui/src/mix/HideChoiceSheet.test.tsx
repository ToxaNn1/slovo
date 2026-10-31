import { EditionProvider, HideChoiceSheet } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const options: ComponentProps<typeof HideChoiceSheet>['options'] = [
  { key: 'entry', label: 'Hide this Entry' },
  { key: 'category', label: 'Hide the Category “Nature”' },
];

async function renderSheet(visible = true, shown: typeof options = options) {
  const onChoose = jest.fn();
  const onCancel = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <HideChoiceSheet
          visible={visible}
          options={shown}
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

  it('offers a row with a disabled hint dimmed, takes no tap on it, and says why', async () => {
    const { onChoose } = await renderSheet(true, [
      { key: 'entry', label: 'Hide this Entry' },
      { key: 'category', label: 'Hide the Category “Work”', disabledHint: 'It is the last one.' },
    ]);

    const row = screen.getByTestId('hide-choice-category');
    expect(row).toBeDisabled();
    expect(row).toHaveProp('accessibilityHint', 'It is the last one.');
    await fireEvent.press(row);
    expect(onChoose).not.toHaveBeenCalled();
    // The line is hidden from VoiceOver, which reads it as the row's hint instead.
    expect(
      screen.getByTestId('hide-choice-category-hint', { includeHiddenElements: true }),
    ).toHaveTextContent('It is the last one.');
    expect(screen.getByTestId('hide-choice-entry')).toBeEnabled();
  });
});
