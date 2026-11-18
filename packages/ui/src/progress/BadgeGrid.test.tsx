import type { BadgeFamily } from '@slovo/contracts';
import { BadgeGrid, type BadgeGridItem, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const levelFive: BadgeGridItem = {
  id: 'level-5',
  name: 'Level five',
  family: 'levels',
  symbol: '5',
  earned: false,
  progress: { current: 0, target: 5 },
};

const badges: readonly BadgeGridItem[] = [
  {
    id: 'streak-3',
    name: 'Three days',
    family: 'streak',
    symbol: '3',
    earned: true,
    isNew: false,
  },
  levelFive,
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

async function draw(onPress: (badge: BadgeGridItem) => void, counts = true) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <BadgeGrid
        families={families}
        badges={badges}
        counts={counts}
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
    expect(screen.queryByTestId('badge-streak-7-mark-symbol')).toBeNull();
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

  // App pass 7a, item 51: «Без лічильників» hides the counts, not the families.
  it('heads each family without its count while the counts are hidden', async () => {
    await draw(() => undefined, false);
    expect(screen.getAllByRole('header')).toHaveLength(2);
    expect(screen.queryByTestId('badge-family-streak-count')).toBeNull();
    expect(screen.queryByText('1 of 2')).toBeNull();
  });

  it('hands the pressed Badge to onPress', async () => {
    const onPress = jest.fn<(badge: BadgeGridItem) => void>();
    await draw(onPress);
    await fireEvent.press(screen.getByLabelText('Level five'));
    expect(onPress).toHaveBeenCalledWith(levelFive);
  });

  it('draws a card for each Badge on the Badges screen with its name, condition and status', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <BadgeGrid
          families={families}
          badges={badges}
          size="screen"
          statusOf={(badge) => (badge.earned ? 'Earned' : 'Not yet')}
          conditionOf={(badge) => `Condition of ${badge.id}`}
          onPress={() => undefined}
        />
      </EditionProvider>,
    );
    for (const { id, name } of badges) {
      expect(screen.getByTestId(`badge-${id}-name`)).toHaveTextContent(name);
      expect(screen.getByTestId(`badge-${id}-condition`)).toHaveTextContent(`Condition of ${id}`);
    }
    expect(screen.getByTestId('badge-streak-3-status')).toHaveTextContent('Earned');
    expect(screen.getByTestId('badge-level-5-status')).toHaveTextContent('Not yet');
  });

  it('writes no name under the marks of the Profile', async () => {
    await draw(() => undefined);
    expect(screen.queryByTestId('badge-streak-3-name')).toBeNull();
  });
});
