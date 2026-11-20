import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Accounts, MistakeReports } from '@slovo/server-core';

import { sessionIfAny } from '../account/session-gate';
import { retryAfter } from '../retry-after';

/** What a request brings to the Mistake Report procedures. */
interface ReportsContext {
  /** The request's headers, where a signed-in reader's Session travels. */
  readonly headers: Headers;
  /** The IP address of the request's connection, which the day's limit counts. */
  readonly ip: string;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/**
 * The Mistake Report procedures of the contract, over the server Core's
 * Mistake Reports. An Edition with Mistake Reports switched off answers
 * `NOT_FOUND`, which the app takes off its queue, and a report over the day's
 * limit of its IP address `TOO_MANY_REQUESTS` with `Retry-After`.
 * A report sent with a Session that is on keeps its Account; one without, or
 * with a Session that is not on, is anonymous and still taken.
 */
export function reportsProcedures(mistakeReports: MistakeReports, accounts: Accounts) {
  const reports = implement(apiContract.reports).$context<ReportsContext>();
  return reports.router({
    send: reports.send.handler(async ({ input, context, errors }) => {
      const session = await sessionIfAny(accounts, context.headers);
      const sent = await mistakeReports.send(input, context.ip, session);
      if (sent.ok) return;
      switch (sent.reason) {
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, sent);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),
  });
}
