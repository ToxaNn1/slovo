import type { PlannedNotification } from '@slovo/core';
import type { NotificationRequestInput, NotificationResponse } from 'expo-notifications';
import { describe, expect, it, vi } from 'vitest';

import {
  createNotificationScheduler,
  notificationLink,
  onNotificationTap,
  type NotificationsModule,
} from './notification-scheduler';

type Status = 'granted' | 'denied' | 'undetermined';

/** A mocked `expo-notifications`: the permission it reports, and what asking turns it into. */
function mockNotifications({
  status = 'granted',
  answer = 'granted',
  lastResponse = null,
}: { status?: Status; answer?: Status; lastResponse?: NotificationResponse | null } = {}) {
  const permission = (value: Status) => ({ status: value, granted: value === 'granted' });
  const tapListeners: ((response: NotificationResponse) => void)[] = [];
  const stopListening = vi.fn();
  const module = {
    PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
    SchedulableTriggerInputTypes: { CALENDAR: 'calendar' },
    getPermissionsAsync: vi.fn(() => Promise.resolve(permission(status))),
    requestPermissionsAsync: vi.fn(() => Promise.resolve(permission(answer))),
    cancelAllScheduledNotificationsAsync: vi.fn(() => Promise.resolve()),
    scheduleNotificationAsync: vi.fn<(request: NotificationRequestInput) => Promise<string>>(() =>
      Promise.resolve('id'),
    ),
    getLastNotificationResponse: vi.fn(() => lastResponse),
    clearLastNotificationResponse: vi.fn(),
    addNotificationResponseReceivedListener: vi.fn(
      (listener: (response: NotificationResponse) => void) => {
        tapListeners.push(listener);
        return { remove: stopListening };
      },
    ),
  };
  return {
    module,
    notifications: module as unknown as NotificationsModule,
    stopListening,
    tap: (response: NotificationResponse) => {
      for (const listener of tapListeners) listener(response);
    },
  };
}

const noSound = { editionSound: undefined };

const planned = (overrides: Partial<PlannedNotification> = {}): PlannedNotification => ({
  date: '2026-10-15',
  time: '09:00',
  title: 'кракелю́р',
  body: 'Сітка тріщин на фарбі.',
  wordId: 'w_00g2ap',
  sound: 'edition',
  ...overrides,
});

/** The response iOS hands over when the reader taps a notification with this `data`. */
const tapOn = (data: Record<string, unknown>) =>
  ({ notification: { request: { content: { data } } } }) as unknown as NotificationResponse;

describe('the notification scheduler on expo-notifications', () => {
  it('schedules a plan as calendar triggers from local date parts, with no time zone', async () => {
    const { module, notifications } = mockNotifications();
    const scheduler = createNotificationScheduler(notifications, {
      editionSound: 'notification.wav',
    });

    await scheduler.replacePlan([planned(), planned({ date: '2026-12-31', time: '19:45' })]);

    expect(module.scheduleNotificationAsync.mock.calls.map(([request]) => request)).toEqual([
      {
        identifier: '2026-10-15T09:00',
        content: {
          title: 'кракелю́р',
          body: 'Сітка тріщин на фарбі.',
          sound: 'notification.wav',
          data: { wordId: 'w_00g2ap' },
        },
        trigger: { type: 'calendar', year: 2026, month: 10, day: 15, hour: 9, minute: 0 },
      },
      {
        identifier: '2026-12-31T19:45',
        content: expect.anything() as unknown,
        trigger: { type: 'calendar', year: 2026, month: 12, day: 31, hour: 19, minute: 45 },
      },
    ]);
    for (const [{ trigger }] of module.scheduleNotificationAsync.mock.calls)
      expect(trigger).not.toHaveProperty('timezone');
  });

  it('cancels the old plan before it schedules the new one', async () => {
    const { module, notifications } = mockNotifications();
    const scheduler = createNotificationScheduler(notifications, noSound);

    await scheduler.replacePlan([planned()]);
    await scheduler.replacePlan([]);

    expect(module.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
    expect(module.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(module.cancelAllScheduledNotificationsAsync.mock.invocationCallOrder[0]).toBeLessThan(
      module.scheduleNotificationAsync.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("plays the Edition's sound, the system sound, or none", async () => {
    const { module, notifications } = mockNotifications();
    const scheduler = createNotificationScheduler(notifications, {
      editionSound: 'notification.wav',
    });

    await scheduler.replacePlan([
      planned({ time: '09:00', sound: 'edition' }),
      planned({ time: '13:00', sound: 'system' }),
      planned({ time: '19:00', sound: 'silent' }),
    ]);

    expect(
      module.scheduleNotificationAsync.mock.calls.map(([{ content }]) => content.sound),
    ).toEqual(['notification.wav', 'default', false]);
  });

  it('reports the permission as allowed, denied or not asked yet', async () => {
    const report = (status: Status) =>
      createNotificationScheduler(
        mockNotifications({ status }).notifications,
        noSound,
      ).permission();

    expect(await report('granted')).toBe('allowed');
    expect(await report('denied')).toBe('denied');
    expect(await report('undetermined')).toBe('not-asked');
  });

  it('asks for the permission only when it is not asked yet', async () => {
    const notAsked = mockNotifications({ status: 'undetermined', answer: 'denied' });
    const denied = mockNotifications({ status: 'denied' });

    expect(await createNotificationScheduler(notAsked.notifications, noSound).askPermission()).toBe(
      'denied',
    );
    expect(notAsked.module.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await createNotificationScheduler(denied.notifications, noSound).askPermission()).toBe(
      'denied',
    );
    expect(denied.module.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('without the module reports not asked yet, asks nothing and schedules nothing', async () => {
    const scheduler = createNotificationScheduler(undefined, { editionSound: 'notification.wav' });

    expect(await scheduler.permission()).toBe('not-asked');
    expect(await scheduler.askPermission()).toBe('not-asked');
    await expect(scheduler.replacePlan([planned()])).resolves.toBeUndefined();
  });
});

describe('a tap on a notification', () => {
  it("opens its Word's link, marked as from a notification", () => {
    expect(notificationLink('w_00g2ap')).toBe('/entry/w_00g2ap?from=notification');
  });

  it('opens the Word of each tap while the app runs, and stops when told', () => {
    const { module, notifications, stopListening, tap } = mockNotifications();
    const open = vi.fn();

    const stop = onNotificationTap(notifications, open);
    tap(tapOn({ wordId: 'w_00g2ap' }));
    tap(tapOn({}));

    expect(open.mock.calls).toEqual([['w_00g2ap']]);
    // So listening again, as after a remount, doesn't open the same Word twice.
    expect(module.clearLastNotificationResponse).toHaveBeenCalled();
    stop();
    expect(stopListening).toHaveBeenCalled();
  });

  it('opens the Word of the tap that launched the app, once', () => {
    const { module, notifications } = mockNotifications({
      lastResponse: tapOn({ wordId: 'w_00g2ap' }),
    });
    const open = vi.fn();

    onNotificationTap(notifications, open);

    expect(open.mock.calls).toEqual([['w_00g2ap']]);
    expect(module.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('listens to nothing without the module', () => {
    const open = vi.fn();

    const stop = onNotificationTap(undefined, open);
    stop();

    expect(open).not.toHaveBeenCalled();
  });
});
