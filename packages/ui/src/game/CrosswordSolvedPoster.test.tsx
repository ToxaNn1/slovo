import { CrosswordSolvedPoster, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  game: {
    dailyCrossword: {
      solvedScreen: {
        title: 'Solved!',
        shareNoSpoiler: 'Share without a spoiler',
        share: 'Share',
        toGames: 'To games',
      },
    },
  },
});

describe('CrosswordSolvedPoster', () => {
  it('reads its share heading in the Edition’s language', async () => {
    await render(
      <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
        <CrosswordSolvedPoster
          time="3:42"
          grid={[[true, false]]}
          share={{ title: 'SLOVO · Crossword 12', line: '3:42' }}
          onShare={jest.fn()}
          onToGames={jest.fn()}
        />
      </EditionProvider>,
    );

    expect(screen.getByRole('header', { name: 'Share without a spoiler' })).toHaveProp(
      'accessibilityLanguage',
      'uk',
    );
  });
});
