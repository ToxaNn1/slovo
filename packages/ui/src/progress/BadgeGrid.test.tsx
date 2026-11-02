import { BadgeGrid, type BadgeGridItem, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const badges: readonly BadgeGridItem[] = [
  { id: 'streak-3', name: 'Three days', condition: { kind: 'streak', days: 3 }, symbol: '3', earned: true },
  { id: 'level-5', name: 'Level five', condition: { kind: 'level', level: 5 }, symbol: '5', earned: false },
];

async function draw(onPress: (badge: BadgeGridItem) => void) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <BadgeGrid badges={badges} onPress={onPress} />
    </EditionProvider>,
  );
}

describe('BadgeGrid', () => {
  it('names each Badge and shows the symbol of an earned one only', async () => {
    await draw(() => undefined);
    expect(screen.getByLabelText('Three days')).toBeOnTheScreen();
    expect(screen.getByLabelText('Level five')).toBeOnTheScreen();
    expect(screen.getByTestId('badge-streak-3-mark-symbol')).toHaveTextContent('3');
    expect(screen.queryByTestId('badge-level-5-mark-symbol')).toBeNull();
  });

  it('hands the pressed Badge to onPress', async () => {
    const onPress = jest.fn<(badge: BadgeGridItem) => void>();
    await draw(onPress);
    fireEvent.press(screen.getByLabelText('Level five'));
    expect(onPress).toHaveBeenCalledWith(badges[1]);
  });
});
