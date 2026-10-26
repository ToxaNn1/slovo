import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, GameModeCard } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

function Card({ best, refusal }: { best?: string; refusal?: string }) {
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={{} as EditionStrings}>
      <GameModeCard
        entryKind="word"
        overline="Definition → word"
        title="Guess the word"
        description="Read a Definition, pick a word"
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
});
