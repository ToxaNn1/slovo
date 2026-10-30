import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  createMemoryUserStatePort,
  createSettings,
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
import config from 'slovo-edition/config';

import SettingsScreen from '../app/settings/index';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { SettingsProvider } from './settings';

/** The Ukrainian Edition with the Account off, and the Daily Limit on or off. */
function editionWith({ dailyLimit }: { dailyLimit: boolean }): Edition {
  const { featureSwitches, ...rest } = config as { featureSwitches: Record<string, boolean> };
  return loadEdition({
    ...rest,
    featureSwitches: { ...featureSwitches, account: false, dailyLimit },
  });
}

/** The Edition the screen reads, as it ships unless a test turns the Daily Limit off. */
let mockEdition: Edition;

/** The user state the settings and the composition keep, one for the whole file. */
let userState: Awaited<ReturnType<typeof openUserState>>;

/** The composition the screen reads, opened afresh for each test. */
let composition: Composition;

jest.mock('../edition/remote-switches', () => ({ useEditionInEffect: () => mockEdition }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: () => undefined }) }));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = editionStrings.settings.dailyLimit;

const clock = { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' };

// The settings open once per app run, so the user state under them stays the same for the file.
beforeAll(async () => {
  userState = await openUserState({ port: createMemoryUserStatePort(new Map()) });
});

beforeEach(async () => {
  mockEdition = editionWith({ dailyLimit: true });
  composition = await openComposition({
    content: createMemoryContentPort({}),
    edition: mockEdition,
    userState: userState,
    clock,
    random: systemRandom,
  });
});

async function renderSettings() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ShellProvider
        shell={testShell({
          userState: opened(trackChanges({ userState, clock })),
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

/** The Daily Limit as the settings keep it in the user state. */
async function keptDailyLimit() {
  const { theme, fontSize, vibration, dailyLimit } = edition.userSettingDefaults;
  const settings = createSettings({
    userState: userState,
    defaults: { theme, fontSize, vibration, dailyLimit },
  });
  return (await settings.read()).dailyLimit;
}

describe('the Daily Limit setting', () => {
  it('offers «Вимк.», 10, 20 and 30 under «Ліміт на день», off to start with', async () => {
    await renderSettings();

    expect(screen.getByText(strings.title)).toBeOnTheScreen();
    for (const label of [strings.off, '10', '20', '30']) {
      expect(screen.getByRole('button', { name: `${strings.title}: ${label}` })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: `${strings.title}: ${strings.off}` })).toBeSelected();
  });

  it('keeps the value the reader chooses, and «Вимк.» turns it off again', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByRole('button', { name: `${strings.title}: 20` }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: `${strings.title}: 20` })).toBeSelected();
    expect(await keptDailyLimit()).toBe(20);

    await fireEvent.press(screen.getByRole('button', { name: `${strings.title}: ${strings.off}` }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(await keptDailyLimit()).toBe('off');
  });

  it('is left out while the Daily Limit is off in effect', async () => {
    mockEdition = editionWith({ dailyLimit: false });
    await renderSettings();

    expect(screen.queryByText(strings.title)).not.toBeOnTheScreen();
  });
});
