import type { ErrorEvent } from '@sentry/react-native';

import { scrubbed } from './personal-data';

/** The part of Sentry's SDK the app uses. A test gives a fake. */
export interface CrashReportsSdk {
  init(options: Parameters<typeof import('@sentry/react-native').init>[0]): void;
}

/**
 * The event with nothing personal left: no user, request or breadcrumbs, no
 * device or server name, and its messages scrubbed. The stack's frames, the
 * device's model and the app's release stay, so the owner can find the bug.
 */
function withoutPersonalData({
  user: _user,
  request: _request,
  breadcrumbs: _breadcrumbs,
  server_name: _serverName,
  extra: _extra,
  ...event
}: ErrorEvent): ErrorEvent {
  const { message, exception, contexts } = event;
  if (message !== undefined) event.message = scrubbed(message);
  if (exception?.values !== undefined) {
    event.exception = {
      ...exception,
      values: exception.values.map((value) =>
        value.value === undefined ? value : { ...value, value: scrubbed(value.value) },
      ),
    };
  }
  if (contexts?.device !== undefined) {
    const { name: _name, ...device } = contexts.device;
    event.contexts = { ...contexts, device };
  }
  return event;
}

/** Sentry's SDK, loaded only when it is used. */
function loadSentry(): CrashReportsSdk {
  // A plain require, so a build without a DSN never runs the SDK's module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@sentry/react-native') as CrashReportsSdk;
}

/**
 * Starts reporting crashes and unhandled errors to Sentry, once, at launch.
 * Without a DSN (`EXPO_PUBLIC_SENTRY_DSN` in the build's environment) it
 * starts nothing and the app runs as before. The environment is the build's
 * EAS Update channel (`beta` for TestFlight, `production` for the App Store),
 * or `development` with none. Release-health sessions are on, so Sentry counts
 * crash-free sessions and users (ADR 0048); a session names only the install
 * Sentry's SDK makes up for it. Sentry gets no personal data: no default PII,
 * user, IP address, email or Account id, no breadcrumbs, and no performance
 * tracing or session replay.
 */
export function startCrashReports(
  dsn: string | undefined,
  channel: string | null,
  load = loadSentry,
): void {
  if (dsn === undefined || dsn === '') return;
  load().init({
    dsn,
    environment: channel === null || channel === '' ? 'development' : channel,
    // The React Native SDK takes `sendDefaultPii` and leaves out `dataCollection`.
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    enableAutoSessionTracking: true,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: withoutPersonalData,
  });
}
