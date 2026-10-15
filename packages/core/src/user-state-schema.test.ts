import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, openUserState, userStateRecords } from './index';

const { activeDays, notificationTimes, notificationSound, notificationPlan, onboardingFinished } =
  userStateRecords;

// Spec #166, "User-state records": each 0.4 record, by its key and the value it keeps.
describe('the 0.4 user-state records', () => {
  it('keeps each record under the key the spec names', () => {
    expect(activeDays.prefix).toBe('activeDays.');
    expect(activeDays.record('2026-10-14').key).toBe('activeDays.2026-10-14');
    expect(notificationTimes.key).toBe('notifications.times');
    expect(notificationSound.key).toBe('notifications.sound');
    expect(notificationPlan.prefix).toBe('notifications.plan.');
    expect(notificationPlan.record('2026-10-14T09:00').key).toBe(
      'notifications.plan.2026-10-14T09:00',
    );
    expect(onboardingFinished.key).toBe('onboarding.finished');
  });

  it('marks the notification times, the sound, the plan and the onboarding finished as staying on the device', () => {
    expect(notificationTimes.sync).toBe('device-only');
    expect(notificationSound.sync).toBe('device-only');
    expect(notificationPlan.sync).toBe('device-only');
    expect(onboardingFinished.sync).toBe('device-only');
  });

  it('marks Active Days as syncing later as a union', () => {
    expect(activeDays.sync).toBe('union');
  });

  it('reads every record as absent before anything is written, with no migration', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });

    expect(await userState.read(notificationTimes)).toBeUndefined();
    expect(await userState.read(notificationSound)).toBeUndefined();
    expect(await userState.read(onboardingFinished)).toBeUndefined();
    expect(await userState.list(activeDays)).toEqual(new Map());
    expect(await userState.list(notificationPlan)).toEqual(new Map());
  });

  it('stores an empty list of times as an empty list, not as an absent record', async () => {
    const records = new Map<string, string>();
    const userState = await openUserState({ port: createMemoryUserStatePort(records) });

    await userState.write(notificationTimes.change([]));

    expect(records.get('notifications.times')).toBe('[]');
    expect(await userState.read(notificationTimes)).toEqual([]);
  });

  it('reads a record that holds no value of its schema as absent', () => {
    expect(notificationTimes.decode('["9:00"]')).toBeUndefined();
    expect(notificationTimes.decode('["09:00","09:00"]')).toBeUndefined();
    expect(
      notificationTimes.decode(
        JSON.stringify(Array.from({ length: 11 }, (_, hour) => `${String(hour + 10)}:00`)),
      ),
    ).toBeUndefined();
    expect(notificationSound.decode('"off"')).toBeUndefined();
    expect(activeDays.record('2026-10-14').decode('false')).toBeUndefined();
    expect(onboardingFinished.decode('"yesterday"')).toBeUndefined();
    expect(notificationPlan.record('2026-10-14T09:00').decode('7')).toBeUndefined();
  });
});

// Spec #215, "User-state records": the best Game result.
describe('the 0.5 user-state record', () => {
  const { gameBest } = userStateRecords;

  it('keeps the best result under `game.best`, marked to keep the higher of two values in sync', () => {
    expect(gameBest.key).toBe('game.best');
    expect(gameBest.sync).toBe('highest');
  });

  it('reads as absent before anything is written, with no migration', async () => {
    const userState = await openUserState({ port: createMemoryUserStatePort() });

    expect(await userState.read(gameBest)).toBeUndefined();
  });

  it('holds the Rounds passed, from 0 to 15, and reads anything else as absent', () => {
    expect(gameBest.decode('0')).toBe(0);
    expect(gameBest.decode('15')).toBe(15);
    for (const text of ['-1', '16', '7.5', '"7"', 'null']) {
      expect(gameBest.decode(text)).toBeUndefined();
    }
  });
});
