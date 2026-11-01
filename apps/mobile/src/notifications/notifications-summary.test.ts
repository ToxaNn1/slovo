import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
  type Edition,
} from '@slovo/core';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  type FakeNotificationScheduler,
} from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { notificationsSummary } from './notifications-summary';
import { count, strings, ukrainian } from '../test-support';

async function open(
  scheduler: FakeNotificationScheduler = createFakeNotificationScheduler(),
): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort(),
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-14T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
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
}

/** The UA Edition with the evening notification off: every time takes a Word. */
const withoutEvening: Pick<Edition, 'isFeatureEnabled'> = {
  isFeatureEnabled: (feature) =>
    feature !== 'eveningNotification' && ukrainian.isFeatureEnabled(feature),
};

const summaryOf = (
  { notifications }: Composition,
  edition: Pick<Edition, 'isFeatureEnabled'> = ukrainian,
) =>
  notificationsSummary({
    notifications: notifications.state,
    edition,
    strings: strings.notifications,
    count,
  });

describe('the «Сповіщення» row of Settings', () => {
  it("counts what the Edition's default times bring: the Word of the Day and the evening one (story 57)", async () => {
    const composition = await open();

    expect(composition.notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
    expect(ukrainian.isFeatureEnabled('eveningNotification')).toBe(true);
    expect(summaryOf(composition)).toBe('2 на день');
  });

  it('counts every time with the evening notification off, as each takes a Word', async () => {
    const composition = await open();

    expect(summaryOf(composition, withoutEvening)).toBe('3 на день');
  });

  it('follows the list as times are removed, and reads «Вимкнено» with none left', async () => {
    const composition = await open();

    await composition.notifications.removeTime('13:00');
    expect(summaryOf(composition)).toBe('2 на день');

    await composition.notifications.removeTime('09:00');
    expect(summaryOf(composition)).toBe('1 на день');

    await composition.notifications.removeTime('19:00');
    expect(summaryOf(composition)).toBe('Вимкнено');
  });

  it('reads «Вимкнено» while iOS denies notifications, and the times again once allowed', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'denied' });
    const composition = await open(scheduler);

    expect(summaryOf(composition)).toBe('Вимкнено');
    expect(composition.notifications.state.times).toEqual(['09:00', '13:00', '19:00']);

    scheduler.setPermission('allowed');
    await composition.resume();
    expect(summaryOf(composition)).toBe('2 на день');
  });

  it('reads «Вимкнено» while permission is not asked yet, and the times once the reader allows them', async () => {
    const composition = await open(createFakeNotificationScheduler({ permission: 'not-asked' }));

    expect(summaryOf(composition)).toBe('Вимкнено');

    await composition.notifications.askPermission();
    expect(summaryOf(composition)).toBe('2 на день');
  });
});
