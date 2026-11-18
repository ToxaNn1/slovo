import type { GameEnd, GameOver, Haptics } from '@slovo/core';
import { EditionProvider, GameEndPoster, HapticsProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    result: { lost: { title: 'Out of lives' } },
    finish: {
      title: 'Finish',
      won: 'Bullseye!',
      more: 'One more round!',
      hits: { one: '{count} of {total} hit', other: '{count} of {total} hits' },
      newBest: 'New best!',
      xp: 'XP',
      xpCount: '+{count} XP',
      best: 'Best',
    },
    finals: { toGames: 'To games', again: 'Again!', review: 'Round review' },
  },
});

const end: GameEnd = { kind: 'lives-over', played: 5, right: 2, xp: 0, newBest: false };

const game: GameOver = {
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
  end,
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

async function renderPoster({
  ended = end,
  review = { kind: 'none' },
}: {
  ended?: GameEnd;
  review?: ComponentProps<typeof GameEndPoster>['review'];
} = {}) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <GameEndPoster
          game={{ ...game, end: ended }}
          end={ended}
          bestResult={undefined}
          onAgain={jest.fn()}
          onToGames={jest.fn()}
          review={review}
          mascot={<Text>Game over. Nice warm-up! A line far wider than any Mascot figure.</Text>}
        />
      </HapticsProvider>
    </EditionProvider>,
  );
}

describe('GameEndPoster', () => {
  it('heads a Game that lost its last Life like one short of its target, as the board does: «FINISH», «ONE MORE ROUND!», the count and the XP tile', async () => {
    await renderPoster();

    expect(screen.getByText('FINISH')).toBeOnTheScreen();
    expect(screen.getByText('ONE MORE ROUND!')).toBeOnTheScreen();
    expect(screen.getByText('2 of 5 hits')).toBeOnTheScreen();
    expect(screen.getByTestId('game-end-xp')).toHaveTextContent('+0 XP', { exact: false });
    expect(screen.queryByText('Out of lives')).toBeNull();
    expect(screen.queryByText('SURVIVAL · 2/5')).toBeNull();
  });

  it('draws the red ground as tall as the panel grows with its text', async () => {
    await renderPoster();

    const ground = screen.getByTestId('game-panel-ground');
    await fireEvent(ground, 'layout', { nativeEvent: { layout: { width: 393, height: 520 } } });

    expect(ground.children[0]).toHaveProp('height', 520);
  });

  it('picks the plural form of the hits by the Rounds played, as «1 of 4 hits» reads', async () => {
    await renderPoster({
      ended: { kind: 'time-up', onTarget: false, played: 4, right: 1, xp: 0, newBest: false },
    });

    expect(screen.getByText('1 of 4 hits')).toBeOnTheScreen();
  });

  it('takes the one form when a single Round was played', async () => {
    await renderPoster({
      ended: { kind: 'time-up', onTarget: true, played: 1, right: 1, xp: 0, newBest: false },
    });

    expect(screen.getByText('1 of 1 hit')).toBeOnTheScreen();
  });

  it('shows no Game Review, nor its heading, when no Round was played', async () => {
    await renderPoster({
      ended: { kind: 'time-up', onTarget: false, played: 0, right: 0, xp: 0, newBest: false },
      review: { kind: 'plain' },
    });

    expect(screen.queryByTestId('game-review')).toBeNull();
    expect(screen.queryByText('Round review')).toBeNull();
  });
});
