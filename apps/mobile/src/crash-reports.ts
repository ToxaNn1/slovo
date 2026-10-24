import type { ErrorEvent } from '@sentry/react-native';

/** The part of Sentry's SDK the app uses. A test gives a fake. */
export interface CrashReportsSdk {
  init(options: Parameters<typeof import('@sentry/react-native').init>[0]): void;
}

/** What a message may quote that is personal data or a secret, and what takes its place. */
const PERSONAL_DATA: readonly (readonly [RegExp, string])[] = [
  [/[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+/g, '[email]'],
  // A Session's token, an Account's id, a Google identity token: a long run of token characters.
  [/[\w.-]{20,}/g, '[token]'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]'],
  [/\b[\da-f]{0,4}(?::[\da-f]{0,4}){2,7}\b/gi, '[ip]'],
  // A Sign-in code.
  [/\b\d{6}\b/g, '[code]'],
];

/** The text with every email, token, IP address and Sign-in code it quotes taken out. */
function scrubbed(text: string): string {
  return PERSONAL_DATA.reduce((rest, [pattern, mark]) => rest.replace(pattern, mark), text);
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
 * starts nothing and the app runs as before. Sentry gets no personal data: no
 * default PII, user, IP address, email or Account id, no breadcrumbs, and no
 * performance tracing or session replay.
 */
export function startCrashReports(dsn: string | undefined, load = loadSentry): void {
  if (dsn === undefined || dsn === '') return;
  load().init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    enableAutoPerformanceTracing: false,
    enableUserInteractionTracing: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: withoutPersonalData,
  });
}
