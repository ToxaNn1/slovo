import { describe, expect, it, jest } from '@jest/globals';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
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
      <ShellProvider
        shell={testShell({ composition: opened(composition), remoteSwitches: switchedTo(edition) })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <BadgesScreen />
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

const strings = editionStrings.settings.badges;

describe('the Badges screen', () => {
  it("shows every UA Edition Badge in a grid by family, the unearned ones with their condition's progress", async () => {
    await renderScreen();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    expect(screen.getByTestId('badges-count')).toHaveTextContent(
      `0 з ${String(edition.badges.length)}`,
    );
    for (const name of Object.values(strings.families))
      expect(screen.getByText(name)).toBeOnTheScreen();
    expect(screen.getByTestId('badge-family-streak-count')).toHaveTextContent('0 з 5');
    for (const { name } of edition.badges) expect(screen.getByLabelText(name)).toBeOnTheScreen();
    expect(screen.getByTestId('badge-streak-3')).toHaveAccessibilityValue({ text: '0 з 3 днів' });
    expect(screen.getByTestId('badge-confirmed-10')).toHaveAccessibilityValue({
      text: '0 з 10 записів',
    });
    expect(screen.getByTestId('badge-true-stress')).toHaveAccessibilityValue({
      text: '0 з 100 правильних відповідей',
    });
    expect(screen.getByTestId('badge-win-stress')).toHaveAccessibilityValue({
      text: 'Ще не отримано',
    });
    // Not only to VoiceOver: each mark shows how far its condition has come.
    expect(screen.getByTestId('badge-streak-3-status')).toHaveTextContent('0 з 3 днів');
    expect(screen.getByTestId('badge-streak-3-status')).toBeVisible();
    expect(screen.getByTestId('badge-win-stress-status')).toHaveTextContent('Ще не отримано');
  });

  it("says the day a Badge was earned in the Edition's words and stamps it at a tap", async () => {
    const composition = await renderScreen();

    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('badge-win-words')).toHaveAccessibilityValue({
      text: 'Отримано 13 жовтня',
    });
    expect(screen.getByTestId('badge-win-words-status')).toHaveTextContent('Отримано 13 жовтня');
    expect(screen.getByTestId('badge-win-words-mark-symbol')).toHaveTextContent('АЯ');
    expect(screen.queryByTestId('badge-streak-3-mark-symbol')).toBeNull();
    expect(screen.getByTestId('badges-count')).toHaveTextContent(
      `1 з ${String(edition.badges.length)}`,
    );

    await fireEvent.press(screen.getByTestId('badge-win-words'));
    expect(screen.getByText(editionStrings.settings.profile.badgeStamp.title)).toBeOnTheScreen();
  });

  it('stamps no Badge at a tap on one not yet earned', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('badge-streak-3'));
    expect(
      screen.queryByText(editionStrings.settings.profile.badgeStamp.title),
    ).not.toBeOnTheScreen();
  });
});
