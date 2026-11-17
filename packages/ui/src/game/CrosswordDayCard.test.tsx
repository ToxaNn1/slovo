import { coreTokens, CrosswordDayCard, EditionProvider, TokensProvider } from '@slovo/ui';
import type { CrosswordDayCardState } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

function card(state: CrosswordDayCardState, onPress: () => void = jest.fn()) {
  return (
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <CrosswordDayCard
          title="Crossword of the day · 2 November"
          state={state}
          onPress={onPress}
          testID="crossword"
        />
      </EditionProvider>
    </TokensProvider>
  );
}

describe('CrosswordDayCard', () => {
  it('reads a crossword not started as one button: its name, size line and action', async () => {
    const onPress = jest.fn();
    await render(card({ kind: 'start', line: '7 × 7, 9 words', action: 'Start' }, onPress));

    const button = screen.getByRole('button', {
      name: 'Crossword of the day · 2 November. 7 × 7, 9 words. Start',
    });
    expect(screen.getByText('7 × 7, 9 words')).toBeOnTheScreen();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows a started crossword as the Words solved of all', async () => {
    await render(card({ kind: 'resume', action: 'Continue', solved: 3, total: 9 }));

    const button = screen.getByRole('button', {
      name: 'Crossword of the day · 2 November. Continue',
    });
    expect(button).toHaveAccessibilityValue({ min: 0, max: 9, now: 3 });
    expect(screen.getByText('Continue')).toBeOnTheScreen();
  });

  it('draws a solved crossword as its grid of cells and blocks, the mark and the time', async () => {
    await render(
      card({
        kind: 'solved',
        mark: '✓ Solved',
        result: 'in 4 min',
        grid: [
          [true, false],
          [true, true],
        ],
      }),
    );

    expect(
      screen.getByRole('button', {
        name: 'Crossword of the day · 2 November. ✓ Solved. in 4 min',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('crossword-cell-0-0')).toBeOnTheScreen();
    expect(screen.getByTestId('crossword-block-0-1')).toBeOnTheScreen();
    expect(screen.getByTestId('crossword-cell-1-1')).toBeOnTheScreen();
    expect(screen.getByText('in 4 min')).toBeOnTheScreen();
  });

  it('leaves the time line out of a solved record without a time', async () => {
    await render(card({ kind: 'solved', mark: '✓ Solved', result: undefined, grid: [[true]] }));

    expect(
      screen.getByRole('button', { name: 'Crossword of the day · 2 November. ✓ Solved' }),
    ).toBeOnTheScreen();
  });
});
