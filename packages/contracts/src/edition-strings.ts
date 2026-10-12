import { z } from 'zod';

import { FontSizeSchema, ThemeSchema } from './edition';
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
  /** The badge on the card of the Word of the Day. */
  wordOfTheDay: z.strictObject({
    /** The badge text; `{day}` stands for the day of the month and `{month}` for its name. */
    badge: TextSchema,
    /** The month names as the badge uses them, January first. */
    months: z.array(TextSchema).length(12),
  }),
  /** The display label of every part of speech. */
  partsOfSpeech: z.record(PartOfSpeechSchema, TextSchema),
  /** The words on the splash, under the Edition's mark. */
  splash: z.strictObject({
    /** The app's name as a wordmark, e.g. "SLOVO". */
    wordmark: TextSchema,
    tagline: TextSchema,
  }),
  settings: z.strictObject({
    /** The Settings screen title. */
    title: TextSchema,
    /** The label over the Theme choice. */
    theme: TextSchema,
    /** The name of every Theme. */
    themes: z.record(ThemeSchema, TextSchema),
    /** The label over the font-size choice. */
    fontSize: TextSchema,
    /** The name of every font size. */
    fontSizes: z.record(FontSizeSchema, TextSchema),
    /** The sample Word the font-size preview shows. */
    fontSizePreview: z.strictObject({
      /** The sample Lemma, Stress marks included. */
      lemma: TextSchema,
      definition: TextSchema,
    }),
  }),
});

export type EditionStrings = z.infer<typeof EditionStringsSchema>;
