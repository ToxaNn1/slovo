import { readFileSync } from 'node:fs';

import { loadEdition } from '@slovo/core';

import { EDITIONS_DIR, openEdition } from './edition-folder';

// Helpers the Language Pack tests share. No module of the package imports them.

/** The Ukrainian Edition's folder. */
export const ukrainianFolder = openEdition(EDITIONS_DIR, 'uk');

/** The Ukrainian Edition, loaded by the Core from its config file as the app loads it. */
export const ukrainian = loadEdition(
  JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as unknown,
);
