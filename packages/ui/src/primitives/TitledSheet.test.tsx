import { EditionProvider, TitledSheet } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderSheet(visible = true) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <TitledSheet
          visible={visible}
          title="Delete «Autumn words»?"
          cancelLabel="Cancel"
          onClose={onClose}
          testID="sheet"
        >
          <Text>The Entries stay.</Text>
        </TitledSheet>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return onClose;
}

describe('TitledSheet', () => {
  it('reads its title as a header that wraps, over its content', async () => {
    await renderSheet();

    const title = screen.getByRole('header', { name: 'Delete «Autumn words»?' });
    expect(title).not.toHaveProp('numberOfLines');
    expect(screen.getByText('The Entries stay.')).toBeVisible();
  });

  it('asks to close from its cancel button', async () => {
    const onClose = await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks to close from a tap on the backdrop', async () => {
    const onClose = await renderSheet();

    await fireEvent.press(screen.getByTestId('sheet-scrim'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows nothing while closed', async () => {
    await renderSheet(false);

    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.queryByText('The Entries stay.')).toBeNull();
  });
});
