import type { CurrentGame, GameEnd, Haptics } from '@slovo/core';
import { EditionProvider, GameEndPoster, HapticsProvider, mascotWidth, space } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    livesOver: '{mode} · {score}/{total}',
    result: { lost: { title: 'Out of lives' } },
    finals: { toGames: 'To games', again: 'Again!' },
  },
});

const game: CurrentGame = {
  modeId: 'survival',
  round: {
    number: 2,
    entryKind: 'word',
    prompt: 'open and honest',
    highlight: undefined,
    gap: undefined,
    labelKind: 'mode',
    lifeLostAfter: 200,
    form: 'pick',
    options: ['ardent', 'candid'].map((text) => ({ text, stressedVowels: [] })),
    answer: undefined,
  },
  roundsPassed: 2,
  roundLimit: 5,
  lives: 0,
  livesAtStart: 3,
  played: [],
  status: 'lost',
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const end: GameEnd = { kind: 'lives-over', played: 5, right: 2, xp: 0, newBest: false };

describe('GameEndPoster', () => {
  it('keeps the Mascot and its line beside the Lives-over title no wider than its figure, leaving the title and line their room', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <GameEndPoster
            game={game}
            end={end}
            modeName="Survival"
            bestResult={undefined}
            onAgain={jest.fn()}
            onToGames={jest.fn()}
            onOpenEntry={undefined}
            mascot={<Text>Game over. Nice warm-up! A line far wider than any Mascot figure.</Text>}
          />
        </HapticsProvider>
      </EditionProvider>,
    );

    expect(screen.getByRole('header', { name: 'Out of lives' })).toBeOnTheScreen();
    expect(screen.getByText('SURVIVAL · 2/5')).toBeOnTheScreen();
    // The figure and the padding the Mascot draws around it: its line wraps under it.
    expect(screen.getByTestId('game-panel-mascot')).toHaveStyle({
      maxWidth: mascotWidth + 2 * space[4],
    });
  });
});
