import { describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/react-native';

import { startCrashReports, type CrashReportsSdk } from './crash-reports';

const EMAIL = 'reader@example.com';
const IP = '203.0.113.7';
const ACCOUNT_ID = 'acc_7f3c9a1e2b4d4c0f9e8a6b5c4d3e2f1a';

/** Stands in for Sentry's SDK: it keeps the options it was started with. */
function fakeSentry() {
  const init = vi.fn<CrashReportsSdk['init']>();
  const load = vi.fn(() => ({ init }));
  return {
    load,
    init,
    /** What the SDK would send for `event`, or null when it sends nothing. */
    sent(event: ErrorEvent) {
      const [options] = init.mock.calls[0] ?? [];
      const beforeSend = options?.beforeSend;
      if (beforeSend === undefined) return event;
      return beforeSend(event, {}) as ErrorEvent | null;
    },
    breadcrumbKept() {
      const [options] = init.mock.calls[0] ?? [];
      return options?.beforeBreadcrumb?.({ message: EMAIL }) ?? null;
    },
  };
}

/** A crash as the SDK would gather it, full of what must not leave the phone. */
const crash: ErrorEvent = {
  type: undefined,
  message: `Could not sign in ${EMAIL}`,
  exception: {
    values: [
      {
        type: 'Error',
        value: `Account ${ACCOUNT_ID} refused for ${EMAIL} from ${IP}`,
        stacktrace: { frames: [{ filename: 'app:///main.jsbundle', function: 'signIn' }] },
      },
    ],
  },
  user: { id: ACCOUNT_ID, email: EMAIL, ip_address: IP },
  request: { url: 'https://api.example.com/auth', headers: { authorization: 'Bearer x' } },
  breadcrumbs: [{ message: `typed ${EMAIL}` }],
  server_name: "Reader's iPhone",
  contexts: { device: { name: "Reader's iPhone", model: 'iPhone17,3' } },
};

describe('crash reports', () => {
  it('starts nothing without a DSN', () => {
    const sentry = fakeSentry();

    startCrashReports(undefined, sentry.load);
    startCrashReports('', sentry.load);

    expect(sentry.load).not.toHaveBeenCalled();
  });

  it('starts Sentry with the DSN, and the event sent carries no email, IP, user or Account id', () => {
    const sentry = fakeSentry();

    startCrashReports('https://key@o1.ingest.sentry.io/1', sentry.load);

    expect(sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/1', sendDefaultPii: false }),
    );
    const sent = sentry.sent(crash);
    expect(sent).not.toBeNull();
    const text = JSON.stringify(sent);
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(IP);
    expect(text).not.toContain(ACCOUNT_ID);
    expect(text).not.toContain('Reader');
    expect(sent).not.toHaveProperty('user');
    expect(sent).not.toHaveProperty('request');
    expect(sent).not.toHaveProperty('breadcrumbs');
    // What the owner needs to find the bug stays.
    expect(sent?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.function).toBe('signIn');
    expect(sent?.contexts?.device?.model).toBe('iPhone17,3');
  });

  it('keeps no breadcrumbs', () => {
    const sentry = fakeSentry();

    startCrashReports('https://key@o1.ingest.sentry.io/1', sentry.load);

    expect(sentry.breadcrumbKept()).toBeNull();
  });
});
