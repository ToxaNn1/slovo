import { z } from 'zod';

import { ThemeSchema } from './edition';
import { PartOfSpeechSchema } from './word';

const TextSchema = z.string().min(1);

/**
 * The UI text of an Edition, in its language: `editions/<edition>/strings.json`.
 * Core screens read every text from here, never from code.
 */
export const EditionStringsSchema = z.strictObject({
  tabs: z.strictObject({
    home: TextSchema,
    settings: TextSchema,
    game: TextSchema,
    saved: TextSchema,
  }),
  /** Shown on a screen that a later version builds. */
  placeholder: TextSchema,
  /** Shown when the Language Pack can't be read. */
  loadFailed: TextSchema,
  /** Shown when the Language Pack holds no Words. */
  noWords: TextSchema,
  /** The display label of every part of speech. */
  partsOfSpeech: z.record(PartOfSpeechSchema, TextSchema),
  settings: z.strictObject({
    /** The Settings screen title. */
    title: TextSchema,
    /** The label over the Theme choice. */
    theme: TextSchema,
    /** The name of every Theme. */
    themes: z.record(ThemeSchema, TextSchema),
  }),
});

export type EditionStrings = z.infer<typeof EditionStringsSchema>;
