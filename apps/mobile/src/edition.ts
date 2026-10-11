import { EditionStringsSchema, EditionTokensSchema, SplashDecorSchema } from '@slovo/contracts';
import { loadDecor, loadEdition } from '@slovo/core';
import { designTokens } from '@slovo/ui';
import config from 'slovo-edition/config';
import decor from 'slovo-edition/decor';
import splash from 'slovo-edition/splash';
import strings from 'slovo-edition/strings';
import tokens from 'slovo-edition/tokens';

/** The Edition this build runs as, validated by the Core at startup. */
export const edition = loadEdition(config);

/** The UI text of the Edition, in its language. */
export const editionStrings = EditionStringsSchema.parse(strings);

/** The Edition's design tokens over the Core's neutral ones. */
export const editionTokens = designTokens(EditionTokensSchema.parse(tokens ?? {}));

/** The Edition's Decor over the Core's neutral Decor, slot by slot. */
export const editionDecor = loadDecor(decor);

/** An optional Edition file it leaves out reaches the app as an empty module. */
const isLeftOut = (file: unknown) =>
  file === undefined ||
  (typeof file === 'object' && file !== null && Object.keys(file).length === 0);

/** The width of the native splash image, which the app's splash draws its mark over. */
export const splashImageWidth = isLeftOut(splash)
  ? undefined
  : SplashDecorSchema.parse(splash).imageWidth;
