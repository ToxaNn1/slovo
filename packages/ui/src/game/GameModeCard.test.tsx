import { EditionProvider, GameModeCard } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

function Card({
  best,
  refusal,
  description = 'Read a Definition, pick a word',
}: {
  best?: string;
  refusal?: string;
  description?: string;
}) {
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
      <GameModeCard
        entryKind="word"
        overline="Definition → word"
        title="Guess the word"
        description={description}
        sample={{ prompt: 'a fuss', answer: 'bustle' }}
        canStart={refusal === undefined}
        refusal={refusal}
        best={best}
        onPress={jest.fn()}
        testID="card"
      />
    </EditionProvider>
  );
}

describe('GameModeCard', () => {
  it('shows the Best result and reads it last', async () => {
    await render(<Card best="Best: 12 of 15" />);

    expect(screen.getByText('Best: 12 of 15')).toBeTruthy();
    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Read a Definition, pick a word. Best: 12 of 15',
    );
  });

  it('keeps the Best result beside the reason a mode cannot start', async () => {
    await render(<Card best="Best: 23" refusal="Too few words." />);

    expect(screen.getByText('Too few words.')).toBeTruthy();
    expect(screen.getByText('Best: 23')).toBeTruthy();
  });

  it('shows no Best result before the first finished Game', async () => {
    await render(<Card />);

    expect(screen.queryByText(/Best/)).toBeNull();
    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Read a Definition, pick a word',
    );
  });

  it('reads a description ending in its own full stop without another', async () => {
    await render(<Card description="Pick one of four." best="Best: 7 of 15" />);

    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Pick one of four. Best: 7 of 15',
    );
  });
});
