import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** How many title templates every Edition lists for its notifications. */
const NOTIFICATION_TITLE_TEMPLATE_COUNT = 10;

/**
 * The titles of an Edition's notifications and its polite pause (ADR 0054).
 * The plan picks a title template for each notification and never the one
 * used last, so the titles don't repeat twice in a row.
 */
export const NotificationTemplatesStringsSchema = z.strictObject({
  /** The title templates, e.g. «Слово дня: {word}». Each takes `{word}`, the Lemma with its Stress marks. */
  titles: z.array(templateOf('word')).length(NOTIFICATION_TITLE_TEMPLATE_COUNT),
  /** The warm farewell, the last notification of the 14th day after the last open, with no Word. */
  farewell: TextSchema,
});
