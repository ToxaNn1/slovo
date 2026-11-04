import { EditionProvider, XpBar } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

/** Every plural form names itself, so a test reads which form the goal picked. */
const forms = (text: string) => ({
  one: `${text} (one)`,
  few: `${text} (few)`,
  many: `${text} (many)`,
  other: `${text} (other)`,
});

const strings = testStrings({
  stats: {
    xpToday: '{count} XP',
    xpBarLabel: 'Experience: {count} XP today',
    xpBarHint: 'Opens the Game',
    wordsTowardGoal: forms('{seen} of {count} words'),
    wordsTowardGoalLabel: forms('Daily Goal: {seen} of {count} words'),
  },
});

const zeroInsets = { top: 0, left: 0, right: 0, bottom: 0 };

function renderBar(
  today: number,
  onPress: () => void,
  goal?: { readonly seen: number; readonly goal: number },
) {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: zeroInsets }}
    >
      <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
        <XpBar today={today} goal={goal} onPress={onPress} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

describe('XpBar', () => {
  it('draws today’s XP as a button that says it opens the Game', async () => {
    await renderBar(12, () => undefined);

    expect(screen.getByRole('button', { name: 'Experience: 12 XP today' })).toBeOnTheScreen();
    expect(screen.getByText('12 XP')).toBeOnTheScreen();
    expect(screen.getByTestId('xp-bar')).toHaveProp('accessibilityHint', 'Opens the Game');
  });

  it('draws the Words Seen today over the Daily Goal in Words when it has one', async () => {
    await renderBar(12, () => undefined, { seen: 3, goal: 10 });

    expect(
      screen.getByRole('button', { name: 'Daily Goal: 3 of 10 words (many)' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('3 of 10 words (many)')).toBeOnTheScreen();
    expect(screen.queryByText('12 XP')).toBeNull();
  });

  it('picks the plural form by the Daily Goal, not by the Words Seen', async () => {
    await renderBar(0, () => undefined, { seen: 5, goal: 21 });

    expect(
      screen.getByRole('button', { name: 'Daily Goal: 5 of 21 words (one)' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('5 of 21 words (one)')).toBeOnTheScreen();
  });

  it('calls back on a tap', async () => {
    const onPress = jest.fn();
    await renderBar(0, onPress);

    await fireEvent.press(screen.getByRole('button', { name: 'Experience: 0 XP today' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
