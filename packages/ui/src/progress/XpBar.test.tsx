import { EditionProvider, XpBar } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  stats: {
    xpToday: '{count} XP',
    xpBarLabel: 'Experience: {count} XP today',
    xpBarHint: 'Opens the Game',
  },
});

const zeroInsets = { top: 0, left: 0, right: 0, bottom: 0 };

function renderBar(today: number, onPress: () => void, goal?: number) {
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

  it('draws today’s XP over the Daily Goal when it has one', async () => {
    await renderBar(12, () => undefined, 20);

    expect(screen.getByRole('button', { name: 'Experience: 12/20 XP today' })).toBeOnTheScreen();
    expect(screen.getByText('12/20 XP')).toBeOnTheScreen();
  });

  it('calls back on a tap', async () => {
    const onPress = jest.fn();
    await renderBar(0, onPress);

    await fireEvent.press(screen.getByRole('button', { name: 'Experience: 0 XP today' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
