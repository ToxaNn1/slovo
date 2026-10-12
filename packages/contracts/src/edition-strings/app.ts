import { z } from 'zod';

import { TextSchema } from '../shared';

/** The texts the whole app shares, outside any one feature. */
export const appStringsShape = {
  /** Shown on a screen that a later version builds. */
  placeholder: TextSchema,
  /**
   * The app's local error state, shown when the Language Pack can't be
   * opened. The app never needs the network for it, so there is no network error.
   */
  loadFailed: z.strictObject({
    title: TextSchema,
    /** Says what went wrong, e.g. "Не вдалося відкрити словник.". */
    message: TextSchema,
    /** The button that tries to open the Language Pack again. */
    retry: TextSchema,
  }),
};
