import { z } from 'zod';

import { TextSchema } from '../shared';

/**
 * The home-screen widget's text. The prebuild writes it into the widget
 * extension's string table, so the Swift code holds no text of its own.
 */
export const WidgetStringsSchema = z.strictObject({
  /** The widget's name in the iOS widget gallery. */
  galleryName: TextSchema,
  /** What the widget does, under its name in the gallery. */
  galleryDescription: TextSchema,
  /** The overline of the Widget Mode Усі слова, e.g. «УСІ СЛОВА». */
  allEntries: TextSchema,
});
