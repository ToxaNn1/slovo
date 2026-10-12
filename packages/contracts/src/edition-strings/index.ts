import { z } from 'zod';

import { appStringsShape } from './app';
import { CorrectionCardStringsSchema } from './correction-card';
import { feedStringsShape } from './feed';
import { SettingsStringsSchema } from './settings';
import { SplashStringsSchema } from './splash';
import { TabsStringsSchema } from './tabs';
import { WordCardStringsSchema } from './word-card';

/**
 * The UI text of an Edition, in its language: `editions/<edition>/strings.json`.
 * Core screens read every text from here, never from code. Each area keeps its
 * strings in its own file, so a feature edits only the area it touches. An
 * area with several keys at the root (the app's and the Feed's) is a `Shape`
 * spread into the root, which keeps `strings.json` flat.
 */
export const EditionStringsSchema = z.strictObject({
  tabs: TabsStringsSchema,
  ...appStringsShape,
  ...feedStringsShape,
  splash: SplashStringsSchema,
  settings: SettingsStringsSchema,
  wordCard: WordCardStringsSchema,
  correctionCard: CorrectionCardStringsSchema,
});

export type EditionStrings = z.infer<typeof EditionStringsSchema>;
