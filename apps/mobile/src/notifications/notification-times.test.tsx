import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { openComposition, systemRandom, type Composition } from '@slovo/core';
import { createMemoryContentPort, seedUserState, loadEdition } from '@slovo/core/testing';
import { EditionProvider } from '@slovo/ui';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderInGestureRoot } from '../shell/test-render';
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
// The installed binary has the time picker; a plain view stands in for its native one.
jest.mock('../device/device-native-modules', () => ({
  nativeModules: {
    has: () => true,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    load: () => (require('react-native') as typeof import('react-native')).View,
  },
}));
// The picker starts at the row's time, or at the device's for a row with none.
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

/** Opens the picker from the row of `slot`, turns it to `time` and keeps it. */
async function pickTime(slot: 'word' | 'reminder', time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  await fireEvent.press(screen.getByTestId(`notifications-${slot}`));
  await fireEvent(
    screen.getByTestId('time-picker'),
    'valueChange',
    {},
    new Date(2026, 9, 27, hours, minutes),
  );
  await fireEvent.press(screen.getByTestId('time-picker-done'));
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
  await renderInGestureRoot(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={edition} strings={editionStrings}>
        <NotificationTimes />
      </EditionProvider>
    </SafeAreaProvider>,
  );
});

// ADR 0200: one switch on top, the Word's and the Reminder's times under it.
describe('the Notification times', () => {
  it('show the switch on and the two rows «Слово» and «Нагадування» at 09:00 and 19:00', () => {
    expect(screen.getByRole('switch', { name: strings.title })).toBeChecked();
    expect(screen.getByTestId('notifications-word')).toHaveTextContent(`${strings.word}09:00`);
    expect(screen.getByTestId('notifications-reminder')).toHaveTextContent(
      `${strings.reminder}19:00`,
    );
    expect(screen.queryByText('+ Додати час')).toBeNull();
  });

  it('hide the rows once switched off, and bring the defaults back once on', async () => {
    await fireEvent(screen.getByRole('switch', { name: strings.title }), 'valueChange', false);
    await settle();

    expect(mockComposition.notifications.state.times).toEqual({ kind: 'off' });
    expect(screen.queryByTestId('notifications-word')).toBeNull();
    expect(screen.queryByTestId('notifications-reminder')).toBeNull();

    await fireEvent(screen.getByRole('switch', { name: strings.title }), 'valueChange', true);
    await settle();

    expect(screen.getByTestId('notifications-word')).toHaveTextContent(`${strings.word}09:00`);
  });

  it('keep a time picked for the Word', async () => {
    await pickTime('word', '07:30');

    expect(mockComposition.notifications.state.times).toEqual({
      kind: 'on',
      word: '07:30',
      reminder: '19:00',
    });
    expect(screen.getByTestId('notifications-word')).toHaveTextContent(`${strings.word}07:30`);
  });

  it('say why a Reminder at or before the Word is refused, until a time is kept', async () => {
    expect(screen.queryByTestId('notifications-order-hint')).toBeNull();

    await pickTime('reminder', '08:00');

    expect(screen.getByTestId('notifications-order-hint')).toHaveTextContent(strings.orderHint);
    expect(screen.getByTestId('notifications-reminder')).toHaveTextContent(
      `${strings.reminder}19:00`,
    );

    await pickTime('reminder', '21:00');

    expect(screen.queryByTestId('notifications-order-hint')).toBeNull();
    expect(screen.getByTestId('notifications-reminder')).toHaveTextContent(
      `${strings.reminder}21:00`,
    );
  });

  it('show «Вимкнено» on the Reminder row with no Reminder', async () => {
    await act(async () => {
      await mockComposition.notifications.chooseOnboardingTime('20:30');
    });
    await settle();

    expect(screen.getByTestId('notifications-reminder')).toHaveTextContent(
      `${strings.reminder}${strings.off}`,
    );
  });

  it('close the picker on «Скасувати» and keep no time', async () => {
    const before = mockComposition.notifications.state.times;
    await fireEvent.press(screen.getByTestId('notifications-word'));

    await fireEvent.press(screen.getByRole('button', { name: strings.cancel }));
    // The sheet slides away before it unmounts.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    expect(screen.queryByTestId('time-picker-done')).toBeNull();
    expect(mockComposition.notifications.state.times).toBe(before);
  });
});
