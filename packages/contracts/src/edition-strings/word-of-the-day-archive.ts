import { z } from 'zod';

import { TextSchema } from '../shared';

/** The Word of the Day archive in «Збережене». */
export const WordOfTheDayArchiveStringsSchema = z.strictObject({
  title: TextSchema,
});
