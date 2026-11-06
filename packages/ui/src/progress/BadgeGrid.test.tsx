import type { BadgeFamily } from '@slovo/contracts';
import { BadgeGrid, type BadgeGridItem, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const badges: readonly BadgeGridItem[] = [
  {
    id: 'streak-3',
    name: 'Three days',
    family: 'streak',
    symbol: '3',
    earned: true,
    isNew: false,
  },
  {
    id: 'level-5',
    name: 'Level five',
    family: 'levels',
    symbol: '5',
    earned: false,
    progress: { current: 0, target: 5 },
  },
  {
    id: 'streak-7',
    name: 'A week',
    family: 'streak',
    symbol: '7',
    earned: false,
    progress: { current: 3, target: 7 },
  },
];

const families: readonly BadgeFamily[] = [
  { id: 'levels', name: 'Levels', description: 'Levels reached.', shape: 'wedge', tone: 'ink' },
  { id: 'games', name: 'Games', description: 'Games won.', shape: 'circle', tone: 'red' },
  { id: 'streak', name: 'Streak', description: 'Days in a row.', shape: 'hexagon', tone: 'red' },
];

const strings = testStrings({
  settings: {
    badges: {
      earnedOf: '{earned} of {total}',
    },
  },
});

async function draw(onPress: (badge: BadgeGridItem) => void) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <BadgeGrid
        families={families}
        badges={badges}
        statusOf={(badge) => (badge.earned ? 'Earned' : 'Not yet')}
        onPress={onPress}
      />
    </EditionProvider>,
  );
}

describe('BadgeGrid', () => {
  it('names each Badge with its status and hides the symbol of one not started', async () => {
    await draw(() => undefined);
    expect(screen.getByLabelText('Three days')).toHaveAccessibilityValue({ text: 'Earned' });
    expect(screen.getByLabelText('Level five')).toHaveAccessibilityValue({ text: 'Not yet' });
    expect(screen.getByTestId('badge-streak-3-mark-symbol')).toHaveTextContent('3');
    expect(screen.queryByTestId('badge-level-5-mark-symbol')).toBeNull();
    expect(screen.getByTestId('badge-streak-7-mark-symbol')).toHaveTextContent('7');
  });

  it("heads each family with a Badge, in the Edition's order, with how many of it are earned", async () => {
    await draw(() => undefined);
    const heads = screen.getAllByRole('header');
    expect(heads).toHaveLength(2);
    expect(heads[0]).toHaveTextContent('Levels');
    expect(heads[1]).toHaveTextContent('Streak');
    expect(screen.getByTestId('badge-family-streak-count')).toHaveTextContent('1 of 2');
    expect(screen.getByTestId('badge-family-levels-count')).toHaveTextContent('0 of 1');
  });

  it('hands the pressed Badge to onPress', async () => {
    const onPress = jest.fn<(badge: BadgeGridItem) => void>();
    await draw(onPress);
    await fireEvent.press(screen.getByLabelText('Level five'));
    expect(onPress).toHaveBeenCalledWith(badges[1]);
  });
});
