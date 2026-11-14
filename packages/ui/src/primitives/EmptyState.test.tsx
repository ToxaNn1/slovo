import { EditionProvider, EmptyState } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { testStrings } from '../test-strings';

async function renderState(props: Partial<ComponentProps<typeof EmptyState>> = {}) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <EmptyState
        testID="empty"
        title="Nothing to learn yet"
        message="Mark «Don’t know» on a card."
        {...props}
      />
    </EditionProvider>,
  );
}

describe('EmptyState', () => {
  it('reads its title and its text to VoiceOver as one element', async () => {
    await renderState();

    expect(
      screen.getByLabelText('Nothing to learn yet. Mark «Don’t know» on a card.'),
    ).toBeTruthy();
    expect(screen.getByText('Nothing to learn yet')).toBeTruthy();
    expect(screen.getByText('Mark «Don’t know» on a card.')).toBeTruthy();
  });

  it('draws the Mascot over the text, 140 wide as on board 09', async () => {
    await renderState({ mascot: (width) => <Text>{`Rupor ${String(width)}`}</Text> });

    expect(screen.getByTestId('empty')).toHaveTextContent(
      'Rupor 140Nothing to learn yetMark «Don’t know» on a card.',
    );
  });

  it('offers its button only when it has one, and runs it on a press', async () => {
    await renderState();
    expect(screen.queryByRole('button')).toBeNull();

    const onPress = jest.fn();
    await renderState({ action: { label: 'New collection', onPress } });
    await fireEvent.press(screen.getByRole('button', { name: 'New collection' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
