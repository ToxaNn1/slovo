import { EditionStringsSchema, EditionTokensSchema } from '@slovo/contracts';
import { loadEdition } from '@slovo/core';
import { designTokens } from '@slovo/ui';
import config from 'slovo-edition/config';
import strings from 'slovo-edition/strings';
import tokens from 'slovo-edition/tokens';

/** The Edition this build runs as, validated by the Core at startup. */
export const edition = loadEdition(config);

/** The UI text of the Edition, in its language. */
export const editionStrings = EditionStringsSchema.parse(strings);

/** The Edition's design tokens over the Core's neutral ones. */
export const editionTokens = designTokens(EditionTokensSchema.parse(tokens ?? {}));
