import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { StreakBreakScreen } from './streak-break-screen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The Break screen over the Core's composition of a test Shell, as the UA Edition ships it. */
async function renderScreen() {
  const composition = await testShell().composition.opened();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <StreakBreakScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

describe('the Break screen', () => {
  it('starts a Break of the length chosen, then shows its last day instead of the button', async () => {
    const composition = await renderScreen();
    expect(screen.getByText(editionStrings.settings.streakBreak.explanation)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('streak-break-days-3'));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('streak-break-start'));
      await Promise.resolve();
    });

    expect(composition.streakBreak.state.kind).toBe('running');
    expect(screen.getByTestId('streak-break-running')).toBeOnTheScreen();
    expect(screen.queryByTestId('streak-break-start')).not.toBeOnTheScreen();
    expect([...composition.xpLog.days.breaks.values()]).toEqual([3]);
  });
});
