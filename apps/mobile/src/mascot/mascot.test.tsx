import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Composition } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { edition, editionStrings } from '../edition/edition';
import { SettingsProvider } from '../settings/settings';
import { ShellProvider } from '../shell-value';
import { opened, settingsAt, switchedTo, testShell } from '../shell/test-support';
import { CELEBRATION_MS, MascotCelebrations } from './mascot';

const { mascot } = edition;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** The celebrations over the Core's composition of a test Shell, with the Mascot on or off in effect and the counters hidden or not. */
async function renderCelebrations({ on = true, noCounters = false } = {}) {
  const composition = await testShell().composition.opened();
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo({
      ...edition,
      isFeatureEnabled: (feature) =>
        feature === 'mascot' ? on : edition.isFeatureEnabled(feature),
    }),
    settings: await settingsAt({ noCounters }),
  });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider shell={shell}>
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <MascotCelebrations />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  return composition;
}

/** Awards XP for `rounds` right Game Rounds, as the Game does. */
async function playRounds(composition: Composition, rounds: number) {
  await act(async () => {
    for (let round = 0; round < rounds; round += 1) {
      composition.xpLog
        .award({ source: 'game-round', mode: 'guess-word', rarity: undefined })
        .commit();
    }
    // Settles the writes without running the celebration's timer out.
    await jest.advanceTimersByTimeAsync(0);
  });
}

/** The Mascot on screen; VoiceOver skips the celebration, so the query looks past what it hides. */
const shownMascot = () => screen.queryByTestId(/^mascot-/, { includeHiddenElements: true });
const celebration = (state: string) =>
  screen.getByTestId(`mascot-${state}`, { includeHiddenElements: true });

beforeEach(() => {
  jest.useFakeTimers({ advanceTimers: true });
});

afterEach(() => {
  jest.useRealTimers();
});

// Ticket #1386: the Mascot's celebrations, which never interrupt the Feed.
describe('the Mascot’s celebrations', () => {
  it('celebrates the first Streak day, the Daily Goal met and a new Level, each for a while', async () => {
    const composition = await renderCelebrations();
    expect(shownMascot()).toBeNull();

    // The 5th XP makes today an Active Day, the first day of the Streak.
    await playRounds(composition, 5);
    expect(celebration('streakMilestone')).toHaveTextContent(mascot.streakMilestone);
    // VoiceOver skips the line, which takes no touch either.
    expect(screen.queryByText(mascot.streakMilestone)).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(CELEBRATION_MS);
    });
    expect(shownMascot()).toBeNull();

    // The 20th XP meets the Daily Goal of 20.
    await playRounds(composition, 15);
    expect(celebration('dailyGoal')).toHaveTextContent(mascot.dailyGoal);

    // The 50th XP reaches Level 1.
    await playRounds(composition, 30);
    expect(celebration('newLevel')).toHaveTextContent(mascot.newLevel);
  });

  it('celebrates a Badge earned by the first win in a Game Mode group', async () => {
    const composition = await renderCelebrations();

    await act(async () => {
      composition.xpLog
        .award({ source: 'game-finished', mode: 'guess-word', right: 10, played: 10 })
        .commit();
      // Settles the writes without running the celebration's timer out.
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(celebration('badge')).toHaveTextContent(mascot.badge);
  });

  it('celebrates nothing while the reader hides the counters («Без лічильників», ADR 0066)', async () => {
    const composition = await renderCelebrations({ noCounters: true });

    // The 50th XP reaches Level 1, past the first Streak day and the Daily Goal.
    await playRounds(composition, 50);

    expect(shownMascot()).toBeNull();
  });

  it('celebrates nothing with its Feature Switch off, as in 0.9', async () => {
    const composition = await renderCelebrations({ on: false });

    await playRounds(composition, 50);

    expect(shownMascot()).toBeNull();
  });
});
