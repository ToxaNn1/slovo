import type { AnalyticsEvent, AnalyticsEvents, AnalyticsPort } from '@slovo/core';
import type { PostHog, PostHogOptions } from 'posthog-react-native';

/** What the adapter uses of PostHog's client. */
export type PostHogClient = Pick<
  PostHog,
  'capture' | 'setPersonProperties' | 'optIn' | 'optOut' | 'optedOut'
>;

/** PostHog's project in the EU (ADR 0068). */
export const POSTHOG_EU_HOST = 'https://eu.i.posthog.com';

/**
 * The client's options: the EU host and an anonymous id, with no session
 * recording, no lifecycle or screen autocapture, no surveys, no preloaded feature flags
 * and no location from the IP address. Each event is sent at once, so
 * nothing waits in a queue.
 */
export const postHogOptions: PostHogOptions = {
  host: POSTHOG_EU_HOST,
  enableSessionReplay: false,
  captureAppLifecycleEvents: false,
  disableSurveys: true,
  preloadFeatureFlags: false,
  disableGeoip: true,
  flushAt: 1,
};

/** PostHog's client, loaded only when the first event is sent. */
function createPostHog(apiKey: string): PostHogClient {
  // A plain require, so a build without a key, or a reader who never shares, never runs the SDK.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('posthog-react-native') as typeof import('posthog-react-native');
  return new sdk.PostHog(apiKey, postHogOptions);
}

/** A questionnaire answer as a person property of the anonymous id: `questionnaire_<question>`. */
function questionnaireAnswer(
  event: AnalyticsEvent,
  properties: AnalyticsEvents[AnalyticsEvent],
): Record<string, string> | undefined {
  if (event !== 'questionnaireAnswered' || !('question' in properties)) return undefined;
  return { [`questionnaire_${properties.question}`]: properties.answer };
}

/**
 * The Core's Analytics port over PostHog. The Core calls it only while the
 * reader shares their anonymous statistics, so the client is made at the
 * first event, never while sharing is off from launch. Turning sharing off
 * opts the client out; the next event, once it is on again, opts it back in.
 * A questionnaire answer is also kept as a person property of the anonymous
 * id, `questionnaire_<question>`, without reloading feature flags.
 * Without a key (`EXPO_PUBLIC_POSTHOG_KEY` in the build's environment) it
 * sends nothing.
 */
export function postHogAnalytics(
  apiKey: string | undefined,
  create: (apiKey: string) => PostHogClient = createPostHog,
): AnalyticsPort {
  if (apiKey === undefined || apiKey === '')
    return { track: () => undefined, stop: () => undefined };
  let client: PostHogClient | undefined;
  return {
    track(event, properties) {
      client ??= create(apiKey);
      if (client.optedOut) void client.optIn();
      client.capture(event, { ...properties });
      const answer = questionnaireAnswer(event, properties);
      if (answer !== undefined) client.setPersonProperties(answer, undefined, false);
    },
    stop() {
      void client?.optOut();
    },
  };
}

/** The app's Analytics port. */
export const deviceAnalytics = postHogAnalytics(process.env.EXPO_PUBLIC_POSTHOG_KEY);
