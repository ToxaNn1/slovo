import { z } from 'zod';

import { TextSchema } from '../shared';

/**
 * How the Core cuts a notification's body, the primary Definition, when it is
 * too long. The Core cuts at a word boundary and adds this mark, so the
 * Edition's language decides how a cut text ends.
 */
export const NotificationBodyStringsSchema = z.strictObject({
  /** Ends a cut body, e.g. «…». */
  ellipsis: TextSchema,
});
