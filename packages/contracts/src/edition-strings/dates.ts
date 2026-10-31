import { z } from 'zod';

import { TextSchema } from '../shared';

/** The month names every date of the app takes, in one place. */
export const DatesStringsSchema = z.strictObject({
  /** The month names as a date takes them, e.g. «27 жовтня», January first. */
  months: z.array(TextSchema).length(12),
  /** The short month names, e.g. «27 жовт.», January first. */
  shortMonths: z.array(TextSchema).length(12),
});
