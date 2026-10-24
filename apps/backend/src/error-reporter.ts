import { DrizzleQueryError } from 'drizzle-orm';
import pg from 'pg';

import { framesOf, nameOf, scrubbed } from './error-text';

/**
 * What the backend tells of an unexpected failure (a 500): its kind, a
 * message with no personal data, the stack's frames and the request's id.
 * It carries nothing of the request itself: no IP address, no headers, no
 * body, no Account.
 */
export interface ErrorReport {
  readonly name: string;
  readonly message: string;
  /** The `at ...` lines of the stack, without the message above them. */
  readonly stack: string;
  readonly requestId: string;
}

/** Where the reports of unexpected failures go: Sentry, or nowhere. A test gives a fake. */
export interface ErrorReporter {
  report(report: ErrorReport): void;
}

/** The reporter of a backend with no Sentry DSN: it reports nothing. */
export const noErrorReporter: ErrorReporter = { report: () => undefined };

/**
 * The report of an unexpected failure of the request. A failed query names
 * its SQL, whose values are `$1`, `$2`...; Postgres's own error names its
 * SQLSTATE and constraint, not its message and detail, which may quote a value.
 */
export function reportOf(error: unknown, requestId: string): ErrorReport {
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause instanceof pg.DatabaseError ? `: ${nameOf(error.cause)}` : '';
    const message = `Failed query: ${error.query}${cause}`;
    return { name: 'DrizzleQueryError', message, stack: framesOf(error), requestId };
  }
  if (error instanceof pg.DatabaseError) {
    return { name: 'DatabaseError', message: nameOf(error), stack: framesOf(error), requestId };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: scrubbed(error.message),
      stack: framesOf(error),
      requestId,
    };
  }
  return { name: 'NonError', message: typeof error, stack: '', requestId };
}
