import { EditionStringsSchema, type Plural } from '@slovo/contracts';
import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  loadEdition,
  openComposition,
  openUserState,
  systemRandom,
  type Composition,
} from '@slovo/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  dateOfTime,
  keepPickedTime,
  notificationsSummary,
  timeOfDay,
} from './notifications-screen';

const editionFile = (name: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../editions/uk/${name}`, import.meta.url)), 'utf8'),
  );

const strings = EditionStringsSchema.parse(editionFile('strings.json'));
const ukrainian = loadEdition(editionFile('edition.json'));

/** The Edition's own plural rules, as the shell's `count` applies them. */
const pluralRules = new Intl.PluralRules(ukrainian.locale);
const count = (forms: Plural, value: number) =>
  (forms[pluralRules.select(value)] ?? forms.other).replace('{count}', String(value));

async function open(): Promise<Composition> {
  return openComposition({
    content: createMemoryContentPort(),
    edition: ukrainian,
    userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
    clock: { now: () => new Date('2026-10-14T09:00:00Z'), timeZone: () => 'Europe/Kyiv' },
    random: systemRandom,
  });
}

const summaryOf = ({ notifications }: Composition) =>
  notificationsSummary({
    notifications: notifications.state,
    strings: strings.notifications,
    count,
  });

describe('the «Сповіщення» row of Settings', () => {
  it("reads how many times a day the Edition's default times make", async () => {
    const composition = await open();

    expect(composition.notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
    expect(summaryOf(composition)).toBe('3 на день');
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
});

describe('the time the picker works with', () => {
  it('reads a picked date as the local time «HH:MM», with a leading zero', () => {
    expect(timeOfDay(new Date(2026, 9, 14, 7, 5))).toBe('07:05');
    expect(timeOfDay(new Date(2026, 9, 14, 21, 30))).toBe('21:30');
    expect(timeOfDay(new Date(2026, 9, 14, 0, 0))).toBe('00:00');
  });

  it('shows a time on the given day, at the same local time', () => {
    const day = new Date(2026, 9, 14, 15, 42, 11);

    expect(timeOfDay(dateOfTime('06:15', day))).toBe('06:15');
    expect(dateOfTime('06:15', day).getDate()).toBe(14);
  });
});

describe('keeping a picked time', () => {
  const picked = (hours: number, minutes: number) => new Date(2026, 9, 14, hours, minutes);

  it('adds a picked time in time order', async () => {
    const { notifications } = await open();

    const refusal = await keepPickedTime({ notifications, picked: picked(11, 30) });

    expect(refusal).toBeUndefined();
    expect(notifications.state.times).toEqual(['09:00', '11:30', '13:00', '19:00']);
  });

  it('changes a time into the picked one, and the list stays in time order', async () => {
    const { notifications } = await open();

    const refusal = await keepPickedTime({ notifications, from: '09:00', picked: picked(20, 15) });

    expect(refusal).toBeUndefined();
    expect(notifications.state.times).toEqual(['13:00', '19:00', '20:15']);
  });

  it('refuses a picked time that is in the list already, and keeps the list', async () => {
    const { notifications } = await open();

    expect(await keepPickedTime({ notifications, picked: picked(13, 0) })).toBe('duplicate');
    expect(await keepPickedTime({ notifications, from: '09:00', picked: picked(19, 0) })).toBe(
      'duplicate',
    );
    expect(notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
  });

  it('keeps the list when a time is changed into itself', async () => {
    const { notifications } = await open();

    expect(
      await keepPickedTime({ notifications, from: '13:00', picked: picked(13, 0) }),
    ).toBeUndefined();
    expect(notifications.state.times).toEqual(['09:00', '13:00', '19:00']);
  });

  it('refuses a time over the limit', async () => {
    const { notifications } = await open();
    for (const hour of [6, 7, 8, 10, 11, 12, 14]) {
      await notifications.addTime(`${String(hour).padStart(2, '0')}:00`);
    }
    expect(notifications.state.canAddTime).toBe(false);

    expect(await keepPickedTime({ notifications, picked: picked(22, 0) })).toBe('limit');
  });
});
