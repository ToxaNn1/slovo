import { EditionStringsSchema } from '@slovo/contracts';
import { loadEdition } from '@slovo/core';
import config from 'slovo-edition/config';
import strings from 'slovo-edition/strings';

/** The Edition this build runs as, validated by the Core at startup. */
export const edition = loadEdition(config);

/** The UI text of the Edition, in its language. */
export const editionStrings = EditionStringsSchema.parse(strings);
