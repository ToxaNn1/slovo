import { z } from 'zod';

import { TextSchema } from '../shared';

/** The words of the force update (ADR 0089): the banner below the soft minimum, the blocking screen below the hard one. */
export const ForceUpdateStringsSchema = z.strictObject({
  /** The banner's line asking the reader to update. */
  banner: TextSchema,
  /** The banner's link to the store. */
  bannerAction: TextSchema,
  /** The accessibility label of the banner's close button. */
  dismiss: TextSchema,
  /** The blocking screen's title. */
  title: TextSchema,
  body: TextSchema,
  /** The blocking screen's button to the store. */
  button: TextSchema,
});
