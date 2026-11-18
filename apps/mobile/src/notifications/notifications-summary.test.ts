import { openComposition, systemRandom, type Composition } from '@slovo/core';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  type FakeNotificationScheduler,
  seedUserState,
} from '@slovo/core/testing';
import { pluralCount } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { notificationsSummary } from './notifications-summary';
import { strings, ukrainian } from '../test-support';

async function open(
  scheduler: FakeNotificationScheduler = createFakeNotificationScheduler(),
): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort(),
    edition: ukrainian,
    userState: await seedUserState(),
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

const summaryOf = ({ notifications }: Composition) =>
  notificationsSummary({
    notifications: notifications.state,
    strings: strings.notifications,
    count: pluralCount('uk'),
  });

describe('the «Сповіщення» row of Settings', () => {
  it("shows every one of the Edition's default times, in the order of the day", async () => {
    const composition = await open();

    expect(composition.notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
    expect(summaryOf(composition)).toBe('09:00, 13:00, 19:00');
  });

  it('counts the times instead once there are more than three', async () => {
    const composition = await open();

    await composition.notifications.keepTime('07:30');
    expect(summaryOf(composition)).toBe('4 рази на день');
  });

  it('follows the list as times are removed, and reads «Вимкнено» with none left', async () => {
    const composition = await open();

    await composition.notifications.removeTime('09:00');
    expect(summaryOf(composition)).toBe('13:00, 19:00');

    await composition.notifications.removeTime('13:00');
    expect(summaryOf(composition)).toBe('19:00');

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
    expect(summaryOf(composition)).toBe('09:00, 13:00, 19:00');
  });

  it('reads «Вимкнено» while permission is not asked yet, and the times once the reader allows them', async () => {
    const composition = await open(createFakeNotificationScheduler({ permission: 'not-asked' }));

    expect(summaryOf(composition)).toBe('Вимкнено');

    await composition.notifications.askPermission();
    expect(summaryOf(composition)).toBe('09:00, 13:00, 19:00');
  });
});
