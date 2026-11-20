import { readFileSync } from 'node:fs';

import type { Plural } from '@slovo/contracts';
import { loadEdition } from '@slovo/core/testing';
import { EDITIONS_DIR, openEditionWithoutRecords } from '@slovo/language-pack/edition';

export { fakeClock } from '@slovo/core/testing';

// Helpers the mobile tests share. No screen or module of the app imports them.

/** The UA Edition's folder. */
export const ukrainianFolder = openEditionWithoutRecords(EDITIONS_DIR, 'uk');

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
