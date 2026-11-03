import { BadgeGrid, type BadgeGridItem, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const badges: readonly BadgeGridItem[] = [
  {
    id: 'streak-3',
    name: 'Three days',
    condition: { kind: 'streak', days: 3 },
    symbol: '3',
    earned: true,
  },
  {
    id: 'level-5',
    name: 'Level five',
    condition: { kind: 'level', level: 5 },
    symbol: '5',
    earned: false,
  },
  {
    id: 'streak-7',
    name: 'A week',
    condition: { kind: 'streak', days: 7 },
    symbol: '7',
    earned: false,
  },
];

const strings = testStrings({
  settings: {
    badges: {
      earnedOf: '{earned} of {total}',
      families: { streak: 'Streak', games: 'Games', entries: 'Entries', levels: 'Levels' },
    },
  },
});

async function draw(onPress: (badge: BadgeGridItem) => void) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <BadgeGrid
        badges={badges}
        statusOf={(badge) => (badge.earned ? 'Earned' : 'Not yet')}
        onPress={onPress}
      />
    </EditionProvider>,
  );
}

describe('BadgeGrid', () => {
  it('names each Badge with its status and shows the symbol of an earned one only', async () => {
    await draw(() => undefined);
    expect(screen.getByLabelText('Three days')).toHaveAccessibilityValue({ text: 'Earned' });
    expect(screen.getByLabelText('Level five')).toHaveAccessibilityValue({ text: 'Not yet' });
    expect(screen.getByTestId('badge-streak-3-mark-symbol')).toHaveTextContent('3');
    expect(screen.queryByTestId('badge-level-5-mark-symbol')).toBeNull();
  });

  it('heads each family, in the order it first comes, with how many of it are earned', async () => {
    await draw(() => undefined);
    const heads = screen.getAllByRole('header');
    expect(heads).toHaveLength(2);
    expect(heads[0]).toHaveTextContent('Streak');
    expect(heads[1]).toHaveTextContent('Levels');
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
