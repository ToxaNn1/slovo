import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  trackChanges,
  type Composition,
  type Edition,
} from '@slovo/core';
import { createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SettingsScreen from '../app/settings/index';
import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

const { config } = activeEditionFiles;

/** The UA Edition with the Account off, and the Daily Goal on or off. */
function editionWith({ dailyGoal }: { dailyGoal: boolean }): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, account: false, dailyGoal },
  });
}

/** The Edition the screen reads, as it ships unless a test turns the Daily Goal off. */
let editionInEffect: Edition;

/** The user state the composition keeps, one for the whole file. */
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: () => undefined }) }));

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
  userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
});

beforeEach(async () => {
  editionInEffect = editionWith({ dailyGoal: true });
  composition = await openOver(editionInEffect);
});

async function renderSettings() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          userState: opened(trackChanges({ userState, clock })),
          remoteSwitches: switchedTo(editionInEffect),
          composition: opened(composition),
        })}
      >
        <EditionProvider edition={edition} strings={editionStrings}>
          <SettingsProvider>
            <SettingsScreen />
          </SettingsProvider>
        </EditionProvider>
      </ShellProvider>
    </SafeAreaProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

/** The Daily Goal as the XP log keeps it, read by a composition opened afresh over the user state. */
async function keptDailyGoal() {
  return (await openOver(editionInEffect)).xpLog.state.dailyGoal?.goal;
}

// Ticket #1369, ADR 0066: the Daily Goal picker of Settings.
describe('the Daily Goal setting', () => {
  it('offers 10, 20, 30 and 50 under «Денна ціль», the Edition’s 20 to start with', async () => {
    await renderSettings();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    for (const label of ['10', '20', '30', '50']) {
      expect(screen.getByRole('button', { name: `${strings.title}: ${label}` })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: `${strings.title}: 20` })).toBeSelected();
  });

  it('keeps the goal the reader chooses in the XP log', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByRole('button', { name: `${strings.title}: 30` }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: `${strings.title}: 30` })).toBeSelected();
    expect(await keptDailyGoal()).toBe(30);
  });

  it('is left out while the Daily Goal is off in effect', async () => {
    editionInEffect = editionWith({ dailyGoal: false });
    composition = await openOver(editionInEffect);
    await renderSettings();

    expect(screen.queryByText(strings.title)).not.toBeOnTheScreen();
  });
});
