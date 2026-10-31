import { readFileSync } from 'node:fs';

import type { Plural } from '@slovo/contracts';
import { loadEdition, type Clock } from '@slovo/core';
import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';

// Helpers the mobile tests share. No screen or module of the app imports them.

/** The UA Edition's folder. */
export const ukrainianFolder = openEdition(EDITIONS_DIR, 'uk');

/** The UA Edition's UI strings. */
export const strings = ukrainianFolder.read('strings');

/** The UA Edition, loaded as the shell loads it: by the Core, from its config file. */
export const ukrainian = loadEdition(
  JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as unknown,
);

const pluralRules = new Intl.PluralRules(ukrainian.locale);

/** The Edition's own plural rules, as the shell's `count` applies them. */
export const count = (forms: Plural, value: number) =>
  (forms[pluralRules.select(value)] ?? forms.other).replace('{count}', String(value));

/** A clock the test moves by hand: `advance` by milliseconds, `moveTo` another time zone. */
export function fakeClock(start = '2026-10-13T09:00:00Z', timeZone = 'Europe/Kyiv') {
  let now = new Date(start).getTime();
  let zone = timeZone;
  const clock: Clock = { now: () => new Date(now), timeZone: () => zone };
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    moveTo: (timeZoneName: string) => {
      zone = timeZoneName;
    },
  };
}
