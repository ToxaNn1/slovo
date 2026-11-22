import type { NodeOptions } from '@sentry/node';

import { noErrorReporter, type ErrorReporter } from './error-reporter';

/**
 * The reporter that sends each report to Sentry, or none when there is no
 * DSN. Sentry gets only the report: none of its integrations runs, so it
 * reads no request, header, body, IP address or user of its own, keeps no
 * breadcrumbs and traces nothing. Its SDK loads only with a DSN. Each report
 * carries the environment of its Deployment, `production` or `staging`. A
 * test gives a `transport` that keeps what would be sent.
 */
export async function createSentryReporter(
  dsn: string | undefined,
  environment: 'production' | 'staging',
  { transport }: Pick<NodeOptions, 'transport'> = {},
): Promise<ErrorReporter> {
  if (dsn === undefined) return noErrorReporter;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment,
    ...(transport === undefined ? {} : { transport }),
    defaultIntegrations: false,
    enableRuntimeChannelInjection: false,
    includeServerName: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeBreadcrumb: () => null,
    // A second guard: an event carries the report and nothing else.
    beforeSend: ({ request: _request, user: _user, breadcrumbs: _breadcrumbs, ...event }) => event,
  });
  return {
    report({ name, message, stack, requestId }) {
      const error = new Error(message);
      error.name = name;
      error.stack = `${name}: ${message}${stack}`;
      Sentry.captureException(error, { tags: { requestId } });
    },
  };
}
