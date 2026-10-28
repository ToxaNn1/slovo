import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';

/**
 * The Mistake Report procedures of the contract. Until the backend keeps
 * reports (#912), it answers every one as an Edition with Mistake Reports
 * switched off: `NOT_FOUND`, which the app takes off its queue (ADR 0056).
 */
export function reportsProcedures() {
  const reports = implement(apiContract.reports);
  return reports.router({
    send: reports.send.handler(({ errors }) => {
      throw errors.NOT_FOUND();
    }),
  });
}
