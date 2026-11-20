import { openComposition, systemRandom, type Composition } from '@slovo/core';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  type FakeNotificationScheduler,
  seedUserState,
} from '@slovo/core/testing';
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
  notificationsSummary({ notifications: notifications.state, strings: strings.notifications });

describe('the «Сповіщення» row of Settings', () => {
  it("shows the Edition's default Word and Reminder times, in the order of the day", async () => {
    const composition = await open();

    expect(summaryOf(composition)).toBe('09:00, 19:00');
  });

  it('follows the times as they change, and reads «Вимкнено» once switched off', async () => {
    const composition = await open();

    await composition.notifications.keepTime('word', '07:30');
    expect(summaryOf(composition)).toBe('07:30, 19:00');

    await composition.notifications.setOn(false);
    expect(summaryOf(composition)).toBe('Вимкнено');
  });

  it('shows the Word time alone with no Reminder', async () => {
    const composition = await open();

    await composition.notifications.chooseOnboardingTime('20:30');
    expect(summaryOf(composition)).toBe('20:30');
  });

  it('reads «Вимкнено» while iOS denies notifications, and the times again once allowed', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'denied' });
    const composition = await open(scheduler);

    expect(summaryOf(composition)).toBe('Вимкнено');

    scheduler.setPermission('allowed');
    await composition.resume();
    expect(summaryOf(composition)).toBe('09:00, 19:00');
  });

  it('reads «Вимкнено» while permission is not asked yet, and the times once the reader allows them', async () => {
    const composition = await open(createFakeNotificationScheduler({ permission: 'not-asked' }));

    expect(summaryOf(composition)).toBe('Вимкнено');

    await composition.notifications.askPermission();
    expect(summaryOf(composition)).toBe('09:00, 19:00');
  });
});
