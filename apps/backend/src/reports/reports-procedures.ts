import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { MistakeReports } from '@slovo/server-core';

/**
 * The Mistake Report procedures of the contract, over the server Core's
 * Mistake Reports. An Edition with Mistake Reports switched off answers
 * `NOT_FOUND`, which the app takes off its queue (ADR 0056).
 */
export function reportsProcedures(mistakeReports: MistakeReports) {
  const reports = implement(apiContract.reports);
  return reports.router({
    send: reports.send.handler(async ({ input, errors }) => {
      const sent = await mistakeReports.send(input);
      if (!sent.ok) throw errors.NOT_FOUND();
    }),
  });
}
