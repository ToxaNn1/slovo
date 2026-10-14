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

  it('marks the notification times, the sound and the plan as staying on the device', () => {
    expect(notificationTimes.sync).toBe('device-only');
    expect(notificationSound.sync).toBe('device-only');
    expect(notificationPlan.sync).toBe('device-only');
  });

  it('marks Active Days as syncing later as a union', () => {
    expect(activeDays.sync).toBe('union');
  });

  it('leaves the other 0.4 record without a mark, so it syncs like the rest (ADR 0005)', () => {
    expect(onboardingFinished.sync).toBeUndefined();
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
