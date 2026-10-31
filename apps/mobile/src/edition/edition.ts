import {
  AppConfigSchema,
  EditionStringsSchema,
  EditionTokensSchema,
  SplashDecorSchema,
} from '@slovo/contracts';
import { loadDecor, loadEdition, loadSeasonalMotifs } from '@slovo/core';
import { designTokens } from '@slovo/ui';
import appConfig from 'slovo-app/config';
import splash from 'slovo-app/splash';

import { deviceActiveEdition } from './device-active-edition';
import { bundledEditions } from './registry';

/**
 * The id of the Edition this app run is for, chosen at launch and fixed for
 * the run (ADR 0065): every module reads the Edition in effect from here, and
 * the shell opens its one Shell for it (ADR 0036).
 */
export const activeEditionId = deviceActiveEdition(bundledEditions);

/** The bundled files of the active Edition. */
export const activeEditionFiles = bundledEditions.files(activeEditionId);

const { config, strings, tokens, decor, illustrations } = activeEditionFiles;

/** The Illustrations the active Edition bundles as assets, by file name (ADR 0055). */
export const editionIllustrations = illustrations;

/** The active Edition, validated by the Core at startup. */
export const edition = loadEdition(config, Object.keys(illustrations));

/** The App Group the app shares with its widget (ADR 0026), from the AppConfig. */
export const appGroup = AppConfigSchema.parse(appConfig).appGroup;

/** The UI text of the Edition, in its language. */
export const editionStrings = EditionStringsSchema.parse(strings);

/** The Edition's design tokens over the Core's neutral ones. */
export const editionTokens = designTokens(EditionTokensSchema.parse(tokens ?? {}));

/** The Edition's Decor over the Core's neutral Decor, slot by slot. */
export const editionDecor = loadDecor(decor);

/** The Edition's motifs per Season and per Holiday, or none when its Decor stays plain (ADR 0055). */
export const seasonalMotifs = loadSeasonalMotifs(decor);

/** The width of the native splash image, which the app's splash draws its mark over. */
export const splashImageWidth = SplashDecorSchema.parse(splash).imageWidth;
