import type { BadgeFamily } from '@slovo/contracts';
import { BadgeFamilies, type BadgeGridItem, EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const families: readonly BadgeFamily[] = [
  { id: 'streak', name: 'Streak', description: 'Days in a row.', shape: 'hexagon', tone: 'red' },
  { id: 'levels', name: 'Levels', description: 'Levels reached.', shape: 'wedge', tone: 'ink' },
  { id: 'games', name: 'Games', description: 'Games won.', shape: 'circle', tone: 'red' },
];

const badge = (id: string, family: string, symbol: string): BadgeGridItem => ({
  id,
  name: id,
  family,
  symbol,
  earned: false,
  progress: { current: 0, target: 3 },
});

const badges: readonly BadgeGridItem[] = [
  badge('streak-3', 'streak', '3'),
  badge('level-5', 'levels', '5'),
  badge('streak-7', 'streak', '7'),
];

const strings = testStrings({
  settings: {
    badges: {
      families: {
        count: { one: '{count} badge', other: '{count} badges' },
        shape: 'SHAPE',
        shapes: {
          hexagon: 'Hexagon',
          shield: 'Shield',
          circle: 'Circle',
          tile: 'Tile',
          wedge: 'Wedge',
          diamond: 'Diamond',
          checker: 'Checker',
        },
      },
    },
  },
});

describe('BadgeFamilies', () => {
  it("shows each family with a Badge, in the Edition's order, with its count, description and shape", async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <BadgeFamilies families={families} badges={badges} />
      </EditionProvider>,
    );
    const heads = screen.getAllByRole('header');
    expect(heads).toHaveLength(2);
    expect(heads[0]).toHaveTextContent('Streak');
    expect(heads[1]).toHaveTextContent('Levels');
    expect(screen.getByTestId('badge-families-streak-count')).toHaveTextContent('2 badges');
    expect(screen.getByTestId('badge-families-levels-count')).toHaveTextContent('1 badge');
    expect(screen.getByTestId('badge-families-streak-description')).toHaveTextContent(
      'Days in a row.',
    );
    expect(screen.getByTestId('badge-families-levels-shape')).toHaveTextContent('SHAPEWedge');
    expect(screen.getByTestId('badge-families-streak-mark-symbol')).toHaveTextContent('3');
    expect(screen.queryByTestId('badge-families-games')).toBeNull();
  });
});
