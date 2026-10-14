import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Composition,
} from './index';

const defaultTimes = ['09:00', '13:00', '19:00'];

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
    edition: {
      isFeatureEnabled: () => true,
      categories: [{ id: 'test', displayName: 'Test' }],
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: true },
        notificationTimes,
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock: { now: () => new Date('2026-10-14T08:00:00+03:00'), timeZone: () => 'Europe/Kyiv' },
    random: { next: () => 0.25 },
  });
}

/** Ten distinct times, in time order. */
const tenTimes = Array.from({ length: 10 }, (_, hour) => `${String(hour + 10)}:00`);

describe('the Notification times', () => {
  it("start as the Edition's default times, with the sound on, and write nothing", async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    expect(notifications.state).toEqual({ times: defaultTimes, sound: true, canAddTime: true });
    expect([...records.keys()].filter((key) => key.startsWith('notifications.'))).toEqual([]);
  });

  it('read the stored times over the Edition defaults, in time order', async () => {
    const records = new Map([['notifications.times', JSON.stringify(['21:30', '07:15'])]]);

    const { notifications } = await run({ records });

    expect(notifications.state.times).toEqual(['07:15', '21:30']);
  });

  it('add a time in time order and keep it for the next app run', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    expect(await notifications.addTime('11:30')).toEqual({ ok: true });

    expect(notifications.state.times).toEqual(['09:00', '11:30', '13:00', '19:00']);
    expect(records.get('notifications.times')).toBe(
      JSON.stringify(['09:00', '11:30', '13:00', '19:00']),
    );
    expect((await run({ records })).notifications.state.times).toEqual([
      '09:00',
      '11:30',
      '13:00',
      '19:00',
    ]);
  });

  it('refuse a time already in the list', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });
    const before = notifications.state;

    expect(await notifications.addTime('13:00')).toEqual({ ok: false, reason: 'duplicate' });

    expect(notifications.state).toBe(before);
    expect(records.has('notifications.times')).toBe(false);
  });

  it('refuse an 11th time, and say a 10th is the last one', async () => {
    const records = new Map([['notifications.times', JSON.stringify(tenTimes.slice(0, 9))]]);
    const { notifications } = await run({ records });

    expect(await notifications.addTime('22:00')).toEqual({ ok: true });
    expect(notifications.state.times).toHaveLength(10);
    expect(notifications.state.canAddTime).toBe(false);

    expect(await notifications.addTime('23:00')).toEqual({ ok: false, reason: 'limit' });
    expect(notifications.state.times).toHaveLength(10);
  });

  it('change a time and keep the list in time order', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    expect(await notifications.changeTime('09:00', '20:45')).toEqual({ ok: true });

    expect(notifications.state.times).toEqual(['13:00', '19:00', '20:45']);
    expect((await run({ records })).notifications.state.times).toEqual(['13:00', '19:00', '20:45']);
  });

  it('refuse to change a time into another one in the list, and allow it at the limit', async () => {
    const records = new Map([['notifications.times', JSON.stringify(tenTimes)]]);
    const { notifications } = await run({ records });

    expect(await notifications.changeTime('10:00', '11:00')).toEqual({
      ok: false,
      reason: 'duplicate',
    });
    expect(await notifications.changeTime('10:00', '10:00')).toEqual({ ok: true });
    expect(await notifications.changeTime('10:00', '08:30')).toEqual({ ok: true });

    expect(notifications.state.times).toEqual(['08:30', ...tenTimes.slice(1)]);
  });

  it('change nothing for a time not in the list', async () => {
    const { notifications } = await run();
    const before = notifications.state;

    expect(await notifications.changeTime('10:00', '11:00')).toBeUndefined();
    await notifications.removeTime('10:00');

    expect(notifications.state).toBe(before);
  });

  it('remove a time', async () => {
    const { notifications } = await run();

    await notifications.removeTime('13:00');

    expect(notifications.state.times).toEqual(['09:00', '19:00']);
  });

  it('keep an empty list empty after the next app run, not the Edition defaults', async () => {
    const records = new Map<string, string>();
    const { notifications } = await run({ records });

    for (const time of defaultTimes) await notifications.removeTime(time);

    expect(notifications.state.times).toEqual([]);
    expect(records.get('notifications.times')).toBe('[]');
    expect((await run({ records })).notifications.state.times).toEqual([]);
  });

  it('refuse a time that is not a local time `HH:MM`', async () => {
    const { notifications } = await run();

    await expect(notifications.addTime('9:00')).rejects.toThrow();
    await expect(notifications.changeTime('09:00', '24:00')).rejects.toThrow();
    expect(notifications.state.times).toEqual(defaultTimes);
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

    await notifications.addTime('13:00');
    await notifications.setSound(true);
    expect(told).toBe(0);
    expect(notifications.state).toBe(before);

    await notifications.removeTime('09:00');
    await notifications.setSound(false);
    expect(told).toBe(2);

    stop();
    await notifications.addTime('09:00');
    expect(told).toBe(2);
  });

  it('make changes one at a time, each from where the one before left', async () => {
    const { notifications } = await run({ notificationTimes: [] });

    const results = await Promise.all(
      ['08:00', '08:00', ...tenTimes].map((time) => notifications.addTime(time)),
    );

    expect(results.filter(({ ok }) => ok)).toHaveLength(10);
    expect(results[1]).toEqual({ ok: false, reason: 'duplicate' });
    expect(results.at(-1)).toEqual({ ok: false, reason: 'limit' });
    expect(notifications.state.times).toEqual(['08:00', ...tenTimes.slice(0, 9)]);
  });
});
