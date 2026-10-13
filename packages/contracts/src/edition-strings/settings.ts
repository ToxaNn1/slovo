import { z } from 'zod';

import { FontSizeSchema, ThemeSchema } from '../edition';
import { TextSchema } from '../shared';

export const SettingsStringsSchema = z.strictObject({
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
  /** The tag on a row that a later version brings. */
  soon: TextSchema,
  /** What VoiceOver reads for a row that a later version brings. Takes `{label}`. */
  soonAccessibilityLabel: TextSchema,
  /** The names of the rows under the Theme and the font size. */
  rows: z.strictObject({
    notifications: TextSchema,
    myMix: TextSchema,
    hidden: TextSchema,
    widgets: TextSchema,
    about: TextSchema,
  }),
  /** The Sounds section and its rows. */
  sounds: z.strictObject({
    section: TextSchema,
    sounds: TextSchema,
    vibration: TextSchema,
    music: TextSchema,
  }),
  /** The About screen. */
  about: z.strictObject({
    /** The Edition's line under its name. Takes `{version}`. */
    editionLine: TextSchema,
    /** What SLOVO is. */
    description: TextSchema,
    /** Where the words come from. */
    sources: TextSchema,
    /** The label over the feedback rows. */
    feedback: TextSchema,
    suggestWord: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
    reportError: z.strictObject({ title: TextSchema, subtitle: TextSchema }),
  }),
});
