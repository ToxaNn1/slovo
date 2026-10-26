import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/**
 * The Edition's words in a notification's body. The Core cuts a body that is
 * too long at a word boundary and adds the ellipsis, so the Edition's language
 * decides how a cut text ends.
 */
export const NotificationBodyStringsSchema = z.strictObject({
  /** Ends a cut body, and a Synonym Row's members after the first 3, e.g. «…». */
  ellipsis: TextSchema,
  /** A Tip's body: its standard form, e.g. «Так: {form}». Takes `{form}`. */
  tipStandardForm: templateOf('form'),
});
