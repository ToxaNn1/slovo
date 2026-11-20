import { z } from 'zod';

import { TextSchema } from '../shared';

/** The texts the whole app shares, outside any one feature. */
export const appStringsShape = {
  /**
   * The app's local error state, shown when the Language Pack can't be
   * opened. The app never needs the network for it, so there is no network error.
   */
  loadFailed: z.strictObject({
    title: TextSchema,
    /** Says what went wrong, e.g. "Не вдалося відкрити словник. Спробуй ще раз — слова нікуди не поділися.". */
    message: TextSchema,
    /** The button that tries to open the Language Pack again. */
    retry: TextSchema,
  }),
  /** The VoiceOver label of the round button that glides a long list back to its top, e.g. "Нагору". */
  scrollToTop: TextSchema,
  /** The label of a screen's back button that goes to wherever the reader came from, e.g. "Назад". */
  back: TextSchema,
  /**
   * The offline plate under the status bar when an action that needs the
   * network finds none, e.g. "Немає з’єднання. Спробуй пізніше.".
   */
  offlinePlate: TextSchema,
};
