import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { XpBarToGame } from './xp-bar';

const mockNavigate = jest.fn<(href: string) => void>();

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));

/** The Edition in effect: as it ships, or with the XP log off. */
const editionWith = ({ xpLog }: { xpLog: boolean }): typeof edition => ({
  ...edition,
  isFeatureEnabled: (feature) => (feature === 'xpLog' ? xpLog : edition.isFeatureEnabled(feature)),
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * The XP bar over the Core's composition of a test Shell, with the XP log on
 * in effect and the counters shown unless a test says otherwise. Gives back
 * the composition, so a test awards XP as the Game does.
 */
async function renderBar({ xpLog = true, hideStreak = false } = {}) {
  const composition = await testShell().composition.opened();
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(editionWith({ xpLog })),
    settings: await settingsAt({ hideStreak }),
  });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <XpBarToGame />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

describe('the XP bar over the Feed', () => {
  it('shows today’s XP as the Game awards it', async () => {
    const composition = await renderBar();
    expect(screen.getByRole('button', { name: 'Досвід: сьогодні 0 XP' })).toBeOnTheScreen();

    await act(async () => {
      composition.xpLog.award({ source: 'game-round' }).commit();
      composition.xpLog.award({ source: 'game-round' }).commit();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Досвід: сьогодні 2 XP' })).toBeOnTheScreen();
    expect(screen.getByText('2 XP')).toBeOnTheScreen();
  });

  it('opens the Game on a tap', async () => {
    await renderBar();

    await fireEvent.press(screen.getByTestId('xp-bar'));

    expect(mockNavigate).toHaveBeenCalledWith('/game');
  });

  it('is left out while the reader hides the counters', async () => {
    await renderBar({ hideStreak: true });

    expect(screen.queryByTestId('xp-bar')).not.toBeOnTheScreen();
  });

  it('is left out with the XP log off in effect', async () => {
    await renderBar({ xpLog: false });

    expect(screen.queryByTestId('xp-bar')).not.toBeOnTheScreen();
  });
});
