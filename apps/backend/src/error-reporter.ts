import { DrizzleQueryError } from 'drizzle-orm';
import pg from 'pg';

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

/** What a message may quote that is personal data or a secret, and what takes its place. */
const PERSONAL_DATA: readonly (readonly [RegExp, string])[] = [
  [/[^\s@"'<>()[\]]+@[^\s@"'<>()[\]]+/g, '[email]'],
  // A Session's token, a Google identity token: a long run of token characters.
  [/[\w.-]{20,}/g, '[token]'],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]'],
  [/\b[\da-f]{0,4}(?::[\da-f]{0,4}){2,7}\b/gi, '[ip]'],
  // A Sign-in code.
  [/\b\d{6}\b/g, '[code]'],
];

/** The message with every email, token, IP address and Sign-in code it quotes taken out. */
function scrubbed(message: string): string {
  return PERSONAL_DATA.reduce((text, [pattern, mark]) => text.replace(pattern, mark), message);
}

/** The `at ...` lines of an error's stack: the code's places, never a value. */
function framesOf(error: Error): string {
  const stack = error.stack ?? '';
  const start = stack.indexOf('\n    at ');
  return start === -1 ? '' : stack.slice(start);
}

/** What names a Postgres error without quoting a value: its SQLSTATE and constraint. */
function named({ code, constraint }: pg.DatabaseError): string {
  return [`SQLSTATE ${code ?? '?'}`, constraint].filter(Boolean).join(' ');
}

/**
 * The report of an unexpected failure of the request. A failed query names
 * its SQL, whose values are `$1`, `$2`...; Postgres's own error names its
 * SQLSTATE and constraint, not its message and detail, which may quote a value.
 */
export function reportOf(error: unknown, requestId: string): ErrorReport {
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause instanceof pg.DatabaseError ? `: ${named(error.cause)}` : '';
    const message = `Failed query: ${error.query}${cause}`;
    return { name: 'DrizzleQueryError', message, stack: framesOf(error), requestId };
  }
  if (error instanceof pg.DatabaseError) {
    return { name: 'DatabaseError', message: named(error), stack: framesOf(error), requestId };
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
