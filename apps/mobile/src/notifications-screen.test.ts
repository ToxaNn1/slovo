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

import { notificationsSummary } from './notifications-screen';

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
