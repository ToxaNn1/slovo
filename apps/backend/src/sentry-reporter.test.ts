import * as Sentry from '@sentry/node';
import { expect, it } from 'vitest';

import { createSentryReporter } from './sentry-reporter';

/** A DSN of no real project: the fake transport sends nothing anywhere. */
const DSN = 'https://public@example.invalid/1';

it('sends Sentry the report alone: no request, user or breadcrumbs, the scrubbed message and the frames', async () => {
  const sent: unknown[] = [];
  const reporter = await createSentryReporter(DSN, 'staging', {
    transport: () => ({
      send: (envelope) => {
        // An envelope is its headers and its items, each an item's headers and its payload.
        for (const [, payload] of envelope[1]) sent.push(payload);
        return Promise.resolve({});
      },
      flush: () => Promise.resolve(true),
    }),
  });
  // What an integration or a careless call might have put on the scope.
  Sentry.setUser({ email: 'anna@mail.com', ip_address: '10.1.2.3' });
  Sentry.addBreadcrumb({ message: 'GET /v1/account?email=anna@mail.com' });

  reporter.report({
    name: 'Error',
    message: 'User [email] not found',
    stack: '\n    at signIn (src/account.ts:10:5)',
    requestId: 'req-1',
  });
  await Sentry.flush(2000);

  const text = JSON.stringify(sent);
  expect(text).not.toContain('anna@mail.com');
  expect(text).not.toContain('10.1.2.3');
  const event = sent.find(
    (payload) => typeof payload === 'object' && payload !== null && 'exception' in payload,
  );
  expect(event).not.toHaveProperty('request');
  expect(event).not.toHaveProperty('user');
  expect(event).not.toHaveProperty('breadcrumbs');
  expect(event).toMatchObject({
    environment: 'staging',
    tags: { requestId: 'req-1' },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'User [email] not found',
          stacktrace: { frames: [expect.objectContaining({ function: 'signIn' })] },
        },
      ],
    },
  });
});
