import { z } from 'zod';

import { TextSchema } from '../shared';

/** One step of the widget guide: what to do and a hint under it. */
const GuideStepSchema = z.strictObject({
  title: TextSchema,
  hint: TextSchema,
});

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
  /** The widget guide that Settings › «Віджети: як додати» opens. */
  guide: z.strictObject({
    /** The screen's title. */
    title: TextSchema,
    /** The steps, in the order the reader does them. */
    steps: z.tuple([GuideStepSchema, GuideStepSchema, GuideStepSchema]),
    /** The sizes the widget comes in, as the widget gallery lists them. */
    sizes: TextSchema,
    /** The Word the drawing's sample widgets show: its Lemma and short line. */
    sample: z.strictObject({ lemma: TextSchema, definition: TextSchema }),
  }),
});
