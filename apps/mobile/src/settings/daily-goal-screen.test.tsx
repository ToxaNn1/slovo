import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  loadEdition,
  openComposition,
  systemRandom,
  type Composition,
  type Edition,
} from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import DailyGoalScreen from '../app/settings/daily-goal';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

/** The UA Edition with the Account off, and the Daily Goal on or off. */
function editionWith({ dailyGoal }: { dailyGoal: boolean }): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, string> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, account: 'off', dailyGoal: dailyGoal ? 'on' : 'off' },
  });
}

/** The Edition the screen reads, as it ships unless a test turns the Daily Goal off. */
let editionInEffect: Edition;

/** The user state the composition keeps, one for the whole file. */
let userState: Awaited<ReturnType<typeof seedUserState>>;

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: () => undefined }),
  // With the Daily Goal off the screen leads back to Settings and draws nothing of its own.
  Redirect: () => null,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = editionStrings.settings.dailyGoal;

const clock = { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

function openOver(edition: Edition) {
  return openComposition({
    content: createMemoryContentPort({}),
    edition,
    userState,
    clock,
    random: systemRandom,
  });
}

// The settings open once per app run, so the user state under them stays the same for the file.
beforeAll(async () => {
  userState = await seedUserState({}, { clock });
});

beforeEach(async () => {
  editionInEffect = editionWith({ dailyGoal: true });
  composition = await openOver(editionInEffect);
});

async function renderDailyGoal() {
  await renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          userState: opened(userState),
          remoteSwitches: switchedTo(editionInEffect),
          composition: opened(composition),
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <DailyGoalScreen />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await settle();
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function choose(name: string) {
  await fireEvent.press(screen.getByRole('radio', { name }));
  await settle();
}

/** The Daily Goal as the XP log keeps it, read by a composition opened afresh over the user state. */
async function keptDailyGoal() {
  return (await openOver(editionInEffect)).xpLog.state.dailyGoal?.goal;
}

// Tickets #1369, #1557 and #1874, ADR 0074: «Ціль дня», screen 85 of board 11.
describe('the Daily Goal screen', () => {
  it('offers the Edition’s 10, 25 and 50 and «Без цілі», «Без цілі» chosen to start with', async () => {
    await renderDailyGoal();

    for (const name of ['10', '25', '50']) {
      expect(screen.getByRole('radio', { name })).not.toBeSelected();
    }
    expect(screen.getByRole('radio', { name: strings.none })).toBeSelected();
    expect(screen.getByText(strings.explanations.none)).toBeOnTheScreen();
  });

  it('keeps the goal the reader chooses in the XP log, and explains it', async () => {
    await renderDailyGoal();

    await choose('25');

    expect(screen.getByRole('radio', { name: '25' })).toBeSelected();
    expect(screen.getByText(strings.explanations['25'])).toBeOnTheScreen();
    expect(await keptDailyGoal()).toBe(25);
  });

  it('turns the goal off from today with «Без цілі», and on again with a number', async () => {
    await renderDailyGoal();

    await choose('10');
    await choose(strings.none);

    expect(screen.getByRole('radio', { name: strings.none })).toBeSelected();
    expect(await keptDailyGoal()).toBeUndefined();

    await choose('50');

    expect(screen.getByRole('radio', { name: strings.none })).not.toBeSelected();
    expect(screen.getByText(strings.explanations['50'])).toBeOnTheScreen();
    expect(await keptDailyGoal()).toBe(50);
  });

  it('leads back to Settings while the Daily Goal is off in effect', async () => {
    editionInEffect = editionWith({ dailyGoal: false });
    composition = await openOver(editionInEffect);
    await renderDailyGoal();

    expect(screen.queryByTestId('daily-goal-screen')).not.toBeOnTheScreen();
  });
});
