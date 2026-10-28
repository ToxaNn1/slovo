import { z } from 'zod';

import { TextSchema } from '../shared';

/** One App Intent: its title in Shortcuts and the phrases Siri answers to, its App Shortcut. */
const AppIntentStringsSchema = z.strictObject({
  /** The intent's title, e.g. «Слово дня». */
  title: TextSchema,
  /** What the reader says to Siri, each with the app's name, e.g. «Слово дня в SLOVO». */
  phrases: z.array(TextSchema).min(1),
});

/**
 * The texts of the App Intents (ADR 0057). The prebuild writes them into the
 * app like the widget's, so the Swift code holds no text of its own.
 */
export const AppIntentsStringsSchema = z.strictObject({
  /** The intent that opens the app on the Word of the Day card. */
  wordOfTheDay: AppIntentStringsSchema,
  /** The intent that opens the Game. */
  openGame: AppIntentStringsSchema,
});
