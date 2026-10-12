import { z } from 'zod';

import { FontSizeSchema, ThemeSchema } from '../edition';
import { TextSchema } from './shared';

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
});
