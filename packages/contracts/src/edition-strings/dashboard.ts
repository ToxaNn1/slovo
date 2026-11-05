import { z } from 'zod';

import { TextSchema } from '../shared';

/** The Dashboard, the home behind «Стрічка» (ADR 0076). The hero's «Розкрити» is `wordOfTheDay.reveal`. */
export const DashboardStringsSchema = z.strictObject({
  /** The hero's link that opens the Feed on the Word of the Day card, «До картки →». */
  toCard: TextSchema,
});
