import { z } from 'zod';

import { TextSchema } from '../shared';
import { templateOf } from './shared';

/** The Feed's own texts: its screen states, the hint and the Word of the Day badge. */
export const feedStringsShape = {
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
    /** The VoiceOver actions that stand in for swiping up and down. */
    nextEntry: TextSchema,
    previousEntry: TextSchema,
    /** The title over a Quick Question in the Feed. */
    quickQuestion: TextSchema,
    /**
     * Today in the Feed's header, e.g. «пн, 2 листопада». Takes `{weekday}`, one of
     * `dates.weekdays`, `{day}`, the day of the month, and `{month}`, one of `dates.months`.
     */
    today: templateOf('weekday', 'day', 'month'),
  }),
  /** The badge, the kicker, the shout and the reveal on the card of the Word of the Day. */
  wordOfTheDay: z.strictObject({
    /** The badge text; `{day}` stands for the day of the month and `{month}` for its name, one of `dates.months`. */
    badge: templateOf('day', 'month'),
    /** The kicker over the Lemma on its tabbed card (ADR 0088), «Слово дня · 7.11»; `{day}` and `{month}` stand for the numbers of the day and the month. */
    kicker: templateOf('day', 'month'),
    /** The shout on its red card while Self-check keeps the meaning closed, «Лови слово!». */
    shout: TextSchema,
    /** The button on its red card that reveals the meaning, «Розкрити». */
    reveal: TextSchema,
  }),
};
