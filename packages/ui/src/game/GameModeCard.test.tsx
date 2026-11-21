import {
  coreTokens,
  EditionProvider,
  GameModeCard,
  GameModeGroupTitle,
  GamesTitle,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

function Card({
  best = '—',
  bestLabel,
  refusal,
  line = 'Read a Definition, pick a word',
  cascadeIndex,
  onPress = jest.fn(),
}: {
  best?: string;
  bestLabel?: string;
  refusal?: string;
  line?: string;
  cascadeIndex?: number;
  onPress?: () => void;
}) {
  return (
    <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
      <GameModeCard
        glyph="?"
        title="Guess the word"
        line={line}
        canStart={refusal === undefined}
        refusal={refusal}
        best={best}
        bestLabel={bestLabel}
        onPress={onPress}
        testID="card"
        {...(cascadeIndex === undefined ? {} : { cascadeIndex })}
      />
    </EditionProvider>
  );
}

describe('the Games hub headings', () => {
  it('reads the big title and a group title in the Edition’s language', async () => {
    await render(
      <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
        <GamesTitle>Games</GamesTitle>
        <GameModeGroupTitle>Quick</GameModeGroupTitle>
      </EditionProvider>,
    );

    expect(screen.getByRole('header', { name: 'Games' })).toHaveProp('accessibilityLanguage', 'uk');
    expect(screen.getByRole('header', { name: 'Quick' })).toHaveProp('accessibilityLanguage', 'uk');
  });
});

describe('GameModeCard', () => {
  it('cascades in as the third row and still reads and takes a tap as one', async () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    await render(
      <Card cascadeIndex={2} best="★ 12" bestLabel="Best: 12 of 15" onPress={onPress} />,
    );
    jest.advanceTimersByTime(1000);

    await fireEvent.press(screen.getByRole('button'));

    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Read a Definition, pick a word. Best: 12 of 15',
    );
    expect(onPress).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('shows the Best result and reads it last, in words', async () => {
    await render(<Card best="★ 12" bestLabel="Best: 12 of 15" />);

    expect(screen.getByText('★ 12')).toBeTruthy();
    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Read a Definition, pick a word. Best: 12 of 15',
    );
  });

  it('shows its whole line and puts a long mark under it, leaving the row its full width', async () => {
    const line =
      'Read a Definition and pick the one word of four that it names, before the time runs out';
    await render(<Card line={line} best="No Game yet" />);

    expect(screen.getByText(line).props['numberOfLines']).toBeUndefined();
    const texts = screen.getByTestId('card-texts');
    expect(within(texts).getByText(line)).toBeTruthy();
    expect(within(texts).getByText('No Game yet')).toBeTruthy();
  });

  it('keeps the Best result with the reason a mode cannot start', async () => {
    await render(<Card best="★ 23" bestLabel="Best: 23" refusal="Too few words." />);

    expect(screen.getByText('Too few words.')).toBeTruthy();
    expect(screen.getByText('★ 23')).toBeTruthy();
  });

  it('reads the reason a mode cannot start in place of its line, as it shows', async () => {
    await render(<Card bestLabel="Best: 23" refusal="Too few words." />);

    expect(screen.queryByText('Read a Definition, pick a word')).toBeNull();
    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Too few words. Best: 23',
    );
  });

  it('shows a dash before the first finished Game and does not read it', async () => {
    await render(<Card />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Read a Definition, pick a word',
    );
  });

  it('reads a line ending in its own full stop without another', async () => {
    await render(<Card line="Pick one of four." best="★ 7" bestLabel="Best: 7 of 15" />);

    expect(screen.getByRole('button').props['accessibilityLabel']).toBe(
      'Guess the word. Pick one of four. Best: 7 of 15',
    );
  });

  it('draws the tile of a mode that can start in red, and of one that cannot in the neutral tile', async () => {
    const { accent, tile } = coreTokens.colors.light;
    await render(<Card />);
    expect(screen.getByTestId('card-tile')).toHaveStyle({ backgroundColor: accent });

    await render(<Card refusal="Too few words." />);
    expect(screen.getByTestId('card-tile')).toHaveStyle({ backgroundColor: tile });
    expect(screen.getByText('Too few words.')).toBeTruthy();
    expect(screen.queryByText('Read a Definition, pick a word')).toBeNull();
  });
});
