import { z } from 'zod';

import { TextSchema } from '../shared';

/** The Feed Notices: Feed cards that are not Entries. */
export const FeedNoticesStringsSchema = z.strictObject({
  weeklyRecap: z.strictObject({ title: TextSchema }),
  /** Asks about yesterday's Word of the Day. */
  yesterday: z.strictObject({ title: TextSchema }),
  /** The card at the Daily Limit. */
  dailyLimit: z.strictObject({
    message: TextSchema,
    /** Hides the card until tomorrow. */
    keepGoing: TextSchema,
  }),
  /** The intro cards of the first week. */
  firstWeek: z.strictObject({
    /** Closes a card for good. */
    close: TextSchema,
    /** The title of the seventh day's card, beside the Streak. */
    lastDayTitle: TextSchema,
  }),
});
