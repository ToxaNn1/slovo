import { describe, expect, it } from 'vitest';

import { openComposition, type Composition } from '../index';
import { createMemoryContentPort } from '../testing';
import { testEdition } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const defaultTimes = ['09:00', '19:00'];

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  notificationTimes = defaultTimes,
}: {
  records?: Map<string, string>;
  /** The Edition's default notification times. */
  notificationTimes?: readonly string[];
} = {}): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort(),
    edition: testEdition({
      isFeatureEnabled: () => true,
      userSettingDefaults: { notificationTimes },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: { now: () => new Date('2026-10-14T08:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0.25 },
  });
}

const stored = (times: readonly string[]) =>
  new Map([['notifications.times', JSON.stringify(times)]]);

// ADR 0200: two Notification times, the Word's and the Reminder's, under one switch.
describe('the Notification times', () => {
  it("start on, at the Edition's default Word and Reminder times, with the sound on, and write nothing", async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    expect(notifications.state).toEqual({
      times: { kind: 'on', word: '09:00', reminder: '19:00' },
      sound: true,
      permission: 'not-asked',
    });
    expect([...records.keys()].filter((key) => key.startsWith('notifications.'))).toEqual([]);
  });

  it('read a stored list as the Word at its first time and the Reminder at its last', async () => {
    const { notifications } = await run({ records: stored(['21:30', '07:15', '13:00']) });

    expect(notifications.state.times).toEqual({ kind: 'on', word: '07:15', reminder: '21:30' });
  });

  it('read one stored time as the Word with no Reminder, and none as off', async () => {
    expect((await run({ records: stored(['08:00']) })).notifications.state.times).toEqual({
      kind: 'on',
      word: '08:00',
      reminder: undefined,
    });
    expect((await run({ records: stored([]) })).notifications.state.times).toEqual({
      kind: 'off',
    });
  });

  it('change the Word time and keep it for the next app run', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    expect(await notifications.keepTime('word', '07:30')).toBeUndefined();

    expect(notifications.state.times).toEqual({ kind: 'on', word: '07:30', reminder: '19:00' });
    expect(records.get('notifications.times')).toBe(JSON.stringify(['07:30', '19:00']));
    expect((await run({ records })).notifications.state.times).toEqual({
      kind: 'on',
      word: '07:30',
      reminder: '19:00',
    });
  });

  it('change the Reminder time, and set one where there was none', async () => {
    const { notifications } = await run({ records: stored(['08:00']) });

    expect(await notifications.keepTime('reminder', '21:00')).toBeUndefined();
    expect(notifications.state.times).toEqual({ kind: 'on', word: '08:00', reminder: '21:00' });

    expect(await notifications.keepTime('reminder', '20:15')).toBeUndefined();
    expect(notifications.state.times).toEqual({ kind: 'on', word: '08:00', reminder: '20:15' });
  });

  it('refuse a Word time at or after the Reminder, and a Reminder time at or before the Word', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });
    const before = notifications.state;

    expect(await notifications.keepTime('word', '19:00')).toBe('order');
    expect(await notifications.keepTime('word', '20:00')).toBe('order');
    expect(await notifications.keepTime('reminder', '09:00')).toBe('order');
    expect(await notifications.keepTime('reminder', '08:00')).toBe('order');

    expect(notifications.state).toBe(before);
    expect(records.has('notifications.times')).toBe(false);
  });

  it('keep the state as it is when a time is changed into itself', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });
    const before = notifications.state;

    expect(await notifications.keepTime('word', '09:00')).toBeUndefined();

    expect(notifications.state).toBe(before);
    expect(records.has('notifications.times')).toBe(false);
  });

  it('switch off, for the next app run too, and back on at the Edition defaults', async () => {
    const records = stored(['07:00', '22:00']);
    const { notifications } = await run({ records });

    await notifications.setOn(false);

    expect(notifications.state.times).toEqual({ kind: 'off' });
    expect(records.get('notifications.times')).toBe('[]');
    expect((await run({ records })).notifications.state.times).toEqual({ kind: 'off' });

    await notifications.setOn(true);
    expect(notifications.state.times).toEqual({ kind: 'on', word: '09:00', reminder: '19:00' });
  });

  it('change no time while off', async () => {
    const records = stored([]);
    const { notifications } = await run({ records });

    expect(await notifications.keepTime('word', '08:00')).toBeUndefined();

    expect(notifications.state.times).toEqual({ kind: 'off' });
    expect(records.get('notifications.times')).toBe('[]');
  });

  it('refuse a time that is not a local time `HH:MM`', async () => {
    const { notifications } = await run();

    await expect(notifications.keepTime('word', '9:00')).rejects.toThrow();
    await expect(notifications.keepTime('reminder', '24:00')).rejects.toThrow();
    expect(notifications.state.times).toEqual({ kind: 'on', word: '09:00', reminder: '19:00' });
  });

  it('switch the sound off and on, for the next app run too', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    await notifications.setSound(false);

    expect(notifications.state.sound).toBe(false);
    expect((await run({ records })).notifications.state.sound).toBe(false);

    await notifications.setSound(true);
    expect(notifications.state.sound).toBe(true);
  });

  it('tell the subscribers of each change, and keep the same state object otherwise', async () => {
    const { notifications } = await run();
    let told = 0;
    const stop = notifications.subscribe(() => {
      told += 1;
    });
    const before = notifications.state;

    await notifications.keepTime('word', '09:00');
    await notifications.setOn(true);
    await notifications.setSound(true);
    expect(told).toBe(0);
    expect(notifications.state).toBe(before);

    await notifications.keepTime('word', '08:00');
    await notifications.setSound(false);
    expect(told).toBe(2);

    stop();
    await notifications.setOn(false);
    expect(told).toBe(2);
  });

  it('stay not asked without a scheduler, and asking does nothing', async () => {
    const { notifications } = await run();

    expect(await notifications.askPermission()).toBe('not-asked');
    expect(notifications.state.permission).toBe('not-asked');
  });

  it('make changes one at a time, each from where the one before left', async () => {
    const { notifications } = await run();

    const refusals = await Promise.all([
      notifications.keepTime('reminder', '22:00'),
      notifications.keepTime('word', '21:00'),
      notifications.keepTime('word', '23:00'),
    ]);

    expect(refusals).toEqual([undefined, undefined, 'order']);
    expect(notifications.state.times).toEqual({ kind: 'on', word: '21:00', reminder: '22:00' });
  });

  // Spec #1553, ticket #1559: the onboarding's «Коли нагадати?».
  it("keep the time chosen on the onboarding as the Word's, with the default Reminder after it", async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    await notifications.chooseOnboardingTime('13:00');

    expect(notifications.state.times).toEqual({ kind: 'on', word: '13:00', reminder: '19:00' });
    expect((await run({ records })).notifications.state.times).toEqual({
      kind: 'on',
      word: '13:00',
      reminder: '19:00',
    });
  });

  it('keep no Reminder when the time chosen on the onboarding is at or after the default one', async () => {
    const { notifications } = await run();

    await notifications.chooseOnboardingTime('20:30');

    expect(notifications.state.times).toEqual({ kind: 'on', word: '20:30', reminder: undefined });
  });

  it('switch off after «Без нагадувань» on the onboarding, never falling back to the defaults', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    await notifications.chooseOnboardingTime(undefined);

    expect(notifications.state.times).toEqual({ kind: 'off' });
    expect((await run({ records })).notifications.state.times).toEqual({ kind: 'off' });
  });
});
