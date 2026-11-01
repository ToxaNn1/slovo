import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type NotificationPermission,
} from '@slovo/core';
import { createFakeNotificationScheduler, createMemoryContentPort } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NotificationsScreen from '../app/settings/notifications';
import { edition, editionStrings } from '../edition/edition';
import { ShellProvider } from '../shell-value';
import { opened, switchedTo, testShell } from '../shell/test-support';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = editionStrings.notifications;

/** Lets the Core's reads and writes and the renders after them finish. */
async function settle() {
  for (let turn = 0; turn < 10; turn += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** A scheduler that reports `permission`, grants a first ask, and counts the asks. */
function stubScheduler(permission: NotificationPermission) {
  const fake = createFakeNotificationScheduler({ permission });
  const asks = jest.fn(() => fake.askPermission());
  return { scheduler: { ...fake, askPermission: asks }, asks };
}

/** Settings › Сповіщення as the app routes to it, over a composition whose scheduler reports `permission`. */
async function render(permission: NotificationPermission): Promise<{
  composition: Composition;
  asks: ReturnType<typeof stubScheduler>['asks'];
}> {
  const { scheduler, asks } = stubScheduler(permission);
  const composition = await openComposition({
    content: createMemoryContentPort(),
    edition,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
    scheduling: {
      scheduler,
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Farewell',
      streakWarning: 'Streak warning',
      goalNotMet: 'Goal not met',
    },
  });
  const shell = testShell({
    composition: opened(composition),
    remoteSwitches: switchedTo(edition),
  });
  await renderRouter(
    {
      _layout: () => (
        <SafeAreaProvider initialMetrics={metrics}>
          <ShellProvider shell={shell}>
            <EditionProvider edition={edition} strings={editionStrings}>
              <Stack screenOptions={{ headerShown: false }} />
            </EditionProvider>
          </ShellProvider>
        </SafeAreaProvider>
      ),
      'settings/notifications': NotificationsScreen,
    },
    { initialUrl: '/settings/notifications' },
  );
  await settle();
  return { composition, asks };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Settings › Сповіщення while the permission is not asked yet', () => {
  it('offers «Увімкнути сповіщення», which asks once, and a grant takes the offer away', async () => {
    const { composition, asks } = await render('not-asked');

    expect(screen.getByTestId('notifications-time-09:00-content')).toBeTruthy();
    expect(screen.queryByTestId('notifications-denied')).toBeNull();
    const enable = screen.getByRole('button', { name: strings.enable });

    await fireEvent.press(enable);
    await settle();

    expect(asks).toHaveBeenCalledTimes(1);
    expect(composition.notifications.state.permission).toBe('allowed');
    expect(screen.queryByTestId('notifications-enable')).toBeNull();
  });
});

describe('Settings › Сповіщення while iOS denies notifications', () => {
  it("says so above the times, with a row that opens the app's iOS settings, and offers no ask", async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { asks } = await render('denied');

    expect(screen.getByTestId('notifications-denied')).toBeTruthy();
    expect(screen.getByText(strings.denied.message)).toBeTruthy();
    expect(screen.queryByTestId('notifications-enable')).toBeNull();
    expect(screen.getByTestId('notifications-time-09:00-content')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: strings.denied.openSettings }));
    await settle();

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(asks).not.toHaveBeenCalled();
  });
});
