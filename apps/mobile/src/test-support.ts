import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EditionStringsSchema, type Plural } from '@slovo/contracts';
import { loadEdition, type Clock } from '@slovo/core';

// Helpers the mobile tests share. No screen or module of the app imports them.

/** A file of the Ukrainian Edition, parsed and not yet checked. */
const editionFile = (name: string): unknown =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../editions/uk/${name}`, import.meta.url)), 'utf8'),
  );

/** The Ukrainian Edition's UI strings. */
export const strings = EditionStringsSchema.parse(editionFile('strings.json'));

/** The Ukrainian Edition, loaded as the shell loads it. */
export const ukrainian = loadEdition(editionFile('edition.json'));

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
