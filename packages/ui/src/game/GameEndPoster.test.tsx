import type { CurrentGame, GameEnd, Haptics } from '@slovo/core';
import { EditionProvider, GameEndPoster, HapticsProvider, mascotWidth, space } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

async function renderPoster() {
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
}

describe('GameEndPoster', () => {
  it('stacks the Lives-over poster as the board does: the mode and score over the title, the Mascot under them', async () => {
    await renderPoster();

    expect(screen.getByRole('header', { name: 'Out of lives' })).toBeOnTheScreen();
    expect(screen.getByText('SURVIVAL · 2/5')).toBeOnTheScreen();
    // The mode and score lead the title, as on board g9.
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn.indexOf('SURVIVAL · 2/5')).toBeLessThan(drawn.indexOf('Out of lives'));
    // A column across the panel: neither the title nor the Mascot's line is squeezed beside the other.
    expect(screen.getByTestId('game-end-panel-foot')).toHaveStyle({ flexDirection: 'column' });
    // The figure and the padding the Mascot draws around it: its line wraps under it.
    expect(screen.getByTestId('game-panel-mascot')).toHaveStyle({
      maxWidth: mascotWidth + 2 * space[4],
    });
  });

  it('draws the red ground as tall as the panel grows with its text', async () => {
    await renderPoster();

    const ground = screen.getByTestId('game-panel-ground');
    await fireEvent(ground, 'layout', { nativeEvent: { layout: { width: 393, height: 520 } } });

    expect(ground.children[0]).toHaveProp('height', 520);
  });
});
