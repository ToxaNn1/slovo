import { coreTokens, EditionProvider, NewLevelScreen, TokensProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { testStrings } from '../test-strings';

async function renderScreen(onClose = jest.fn()) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <NewLevelScreen
          level={4}
          kicker="LEVEL"
          title="Level 4 — Bookworm"
          line="A new Level! Keep it up."
          doneLabel="DONE"
          onClose={onClose}
        />
      </EditionProvider>
    </TokensProvider>,
  );
  return onClose;
}

describe('NewLevelScreen (board 10, the new Level)', () => {
  it('shows the kicker, the number, the title and the line under the title', async () => {
    await renderScreen();
    const ground = screen.getByTestId('new-level');

    expect(within(ground).getByText('LEVEL')).toBeOnTheScreen();
    expect(within(ground).getByText('4')).toBeOnTheScreen();
    expect(within(ground).getByRole('header', { name: 'Level 4 — Bookworm' })).toBeOnTheScreen();
    expect(within(ground).getByTestId('new-level-line')).toHaveTextContent(
      'A new Level! Keep it up.',
    );
  });

  it('draws the kicker small in a corner, not as a giant word the number overlaps', async () => {
    await renderScreen();

    expect(screen.getByText('LEVEL')).not.toHaveProp('adjustsFontSizeToFit', true);
    expect(screen.getByText('LEVEL')).toHaveStyle({ position: 'absolute', fontSize: 44 });
  });

  it('closes on its button', async () => {
    const onClose = await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'DONE' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
