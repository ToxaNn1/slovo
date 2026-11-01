import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { loadEdition, openComposition, systemRandom, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { activeEditionFiles, edition, editionStrings } from '../edition/edition';
import { NotificationTimes } from './notification-times';

const { config } = activeEditionFiles;

const strings = editionStrings.notifications;

/** The UA Edition as its config file gives it. */
const mockEdition = loadEdition(config);

/** The composition the times read, opened afresh for each test. */
let mockComposition: Composition;

jest.mock('../composition', () => ({ useComposition: () => mockComposition }));
// The installed binary has the time picker; its native view stays out of the test.
jest.mock('../device/device-native-modules', () => ({
  nativeModules: { has: () => true, load: () => undefined },
}));
// The picker starts at the device's time, 09:00, so «Готово» as it opens picks 09:00.
jest.mock('../device/device-clock', () => ({
  deviceClock: { now: () => new Date(2026, 9, 27, 9, 0), timeZone: () => 'Europe/Kyiv' },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Lets the notifications' writes and the renders after them finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Picks the time the picker opens at, 09:00, as a new time. */
async function addTheDeviceTime() {
  await fireEvent.press(screen.getByTestId('notifications-add-time'));
  await fireEvent.press(screen.getByTestId('time-picker-done'));
  await settle();
}

/** Removes a time through the VoiceOver action of its row. */
async function removeTime(time: string) {
  await fireEvent(screen.getByTestId(`notifications-time-${time}-content`), 'accessibilityAction', {
    nativeEvent: { actionName: 'remove' },
  });
  await settle();
}

beforeEach(async () => {
  mockComposition = await openComposition({
    content: createMemoryContentPort({}),
    edition: mockEdition,
    userState: await seedUserState(),
    clock: { now: () => new Date('2026-10-27T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
  await mockComposition.notifications.keepTime('09:00');
  await mockComposition.notifications.keepTime('21:00');
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <NotificationTimes />
      </EditionProvider>
    </SafeAreaProvider>,
  );
});

describe('the duplicate hint', () => {
  it('shows after a refused duplicate time and goes once the list changes', async () => {
    expect(screen.queryByTestId('notifications-duplicate-hint')).toBeNull();

    await addTheDeviceTime();

    expect(screen.getByTestId('notifications-duplicate-hint')).toHaveTextContent(
      strings.duplicateHint,
    );
    expect(screen.getByTestId('notifications-time-09:00')).toBeTruthy();

    await removeTime('21:00');

    expect(screen.queryByTestId('notifications-time-21:00')).toBeNull();
    expect(screen.queryByTestId('notifications-duplicate-hint')).toBeNull();
  });

  it('stays while the list stays, through a change of the sound', async () => {
    await addTheDeviceTime();

    await act(async () => {
      await mockComposition.notifications.setSound(false);
    });
    await settle();

    expect(screen.getByTestId('notifications-duplicate-hint')).toBeTruthy();
  });
});
