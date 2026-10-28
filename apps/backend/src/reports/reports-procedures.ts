import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { MistakeReports } from '@slovo/server-core';

import { retryAfter } from '../retry-after';

/** What a request brings to the Mistake Report procedures. */
interface ReportsContext {
  /** The IP address of the request's connection, which the day's limit counts. */
  readonly ip: string;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/**
 * The Mistake Report procedures of the contract, over the server Core's
 * Mistake Reports. An Edition with Mistake Reports switched off answers
 * `NOT_FOUND`, which the app takes off its queue, and a report over the day's
 * limit of its IP address `TOO_MANY_REQUESTS` with `Retry-After` (ADR 0056).
 */
export function reportsProcedures(mistakeReports: MistakeReports) {
  const reports = implement(apiContract.reports).$context<ReportsContext>();
  return reports.router({
    send: reports.send.handler(async ({ input, context, errors }) => {
      const sent = await mistakeReports.send(input, context.ip);
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
