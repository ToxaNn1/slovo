import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { BadgesScreen } from './badges-screen';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The Badges screen over the Core's composition of a test Shell, as the UA Edition ships it. */
async function renderScreen() {
  const composition = await testShell().composition.opened();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={testShell({ composition: opened(composition) })}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <BadgesScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
}

describe('the Badges screen', () => {
  it("shows every UA Edition Badge by name, the unearned ones with their condition's progress", async () => {
    await renderScreen();

    expect(screen.getByText(editionStrings.settings.badges.title)).toBeOnTheScreen();
    for (const { name } of edition.badges) expect(screen.getByText(name)).toBeOnTheScreen();
    expect(screen.getByTestId('badge-streak-3-status')).toHaveTextContent('0 з 3 днів');
    expect(screen.getByTestId('badge-confirmed-10-status')).toHaveTextContent('0 з 10 записів');
    expect(screen.getByTestId('badge-true-stress-status')).toHaveTextContent(
      '0 з 100 правильних відповідей',
    );
    expect(screen.getByTestId('badge-win-stress-status')).toHaveTextContent('Ще не отримано');
  });
});
