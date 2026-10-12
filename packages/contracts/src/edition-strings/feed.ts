import { z } from 'zod';

import { TextSchema } from '../shared';

/** The Feed's own texts: its screen states, the hint and the Word of the Day badge. */
export const feedStringsShape = {
  /** Shown on a screen that a later version builds. */
  placeholder: TextSchema,
  /**
   * The Feed's local error state, shown when the Language Pack can't be
   * opened. The Feed never needs the network, so there is no network error.
   */
  loadFailed: z.strictObject({
    title: TextSchema,
    /** Says what went wrong, e.g. "Не вдалося відкрити словник.". */
    message: TextSchema,
    /** The button that tries to open the Language Pack again. */
    retry: TextSchema,
  }),
  /** Shown when the Language Pack holds no Words. */
  noWords: TextSchema,
  /** The end-of-Cycle card, shown once the reader has Seen every live Entry. */
  endOfCycle: z.strictObject({
    title: TextSchema,
    /** Asks the reader to wait for new Entries and says the next swipe starts a new Cycle. */
    message: TextSchema,
  }),
  /** The Feed around its cards. */
  feed: z.strictObject({
    /** Shown under the skeleton card while the Language Pack opens. */
    loading: TextSchema,
    /** What VoiceOver says while the Feed loads. */
    loadingLabel: TextSchema,
    /** The first-launch hint that shows how to reach the next card. */
    swipeHint: TextSchema,
    /** The VoiceOver actions that stand in for swiping up and down. */
    nextEntry: TextSchema,
    previousEntry: TextSchema,
  }),
  /** The badge on the card of the Word of the Day. */
  wordOfTheDay: z.strictObject({
    /** The badge text; `{day}` stands for the day of the month and `{month}` for its name. */
    badge: TextSchema,
    /** The month names as the badge uses them, January first. */
    months: z.array(TextSchema).length(12),
  }),
};
