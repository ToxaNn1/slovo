/** The App Intents (ADR 0057), by the key of their Edition strings. */
export const APP_INTENTS = ['wordOfTheDay', 'openGame'] as const;

export type AppIntent = (typeof APP_INTENTS)[number];

/** The search param that marks a link as an App Intent's, `intent=<intent>`. */
export const APP_INTENT_PARAM = 'intent';

/**
 * The route each App Intent hands the app as `<scheme>://<route>`: «Слово
 * дня» the app's start, the Feed, and «Відкрити гру» the Game, each marked as
 * the intent's, so the app lands it (`createOutsideLinks`). The prebuild
 * writes them into the App Shortcuts (`plugins/app-intents.ts`).
 */
export const APP_INTENT_ROUTES: Readonly<Record<AppIntent, string>> = {
  wordOfTheDay: `?${APP_INTENT_PARAM}=wordOfTheDay`,
  openGame: `game?${APP_INTENT_PARAM}=openGame`,
};
