import { DrizzleQueryError } from 'drizzle-orm';
import pg from 'pg';
import { pino, type DestinationStream, type Logger } from 'pino';

/** The fields a log line never shows: personal data and secrets (spec #333). */
const REDACTED_FIELDS = ['email', 'code', 'token', 'authorization'];

/** The `at ...` lines of an error's stack, without the message above them. */
function framesOf(error: Error): string {
  const stack = error.stack ?? '';
  const start = stack.indexOf('\n    at ');
  return start === -1 ? '' : stack.slice(start);
}

/**
 * An error as a log line shows it. A failed query names its SQL, whose values
 * are `$1`, `$2`...: the values themselves (an email, a Session token, a
 * rate-limit key) stay out, and so do the message and the stack that repeat
 * them. Postgres's own error keeps what names it (the SQLSTATE, the
 * constraint, the table) and leaves out its message and detail, which may
 * quote a value. An error met again down its own causes is not shown twice.
 */
function serializeError(error: unknown, shown = new WeakSet<Error>()): unknown {
  if (error instanceof Error) {
    if (shown.has(error)) return '[shown above]';
    shown.add(error);
  }
  if (error instanceof DrizzleQueryError) {
    return {
      type: 'DrizzleQueryError',
      message: 'Failed query',
      query: error.query,
      stack: `DrizzleQueryError: Failed query${framesOf(error)}`,
      cause: serializeError(error.cause, shown),
    };
  }
  if (error instanceof pg.DatabaseError) {
    const { severity, code, schema, table, column, dataType, constraint, routine } = error;
    return {
      type: 'DatabaseError',
      severity,
      errorCode: code,
      schema,
      table,
      column,
      dataType,
      constraint,
      routine,
      stack: `DatabaseError${framesOf(error)}`,
    };
  }
  if (!(error instanceof Error)) return error;
  const { code, ...serialized }: Record<string, unknown> = pino.stdSerializers.err(error);
  return {
    ...serialized,
    // pino adds the message and stack of every cause; each cause comes
    // below instead, as this function shows it.
    message: error.message,
    stack: error.stack,
    // An error's `code` names its kind (`ECONNREFUSED`), not a Sign-in code.
    ...(code === undefined ? {} : { errorCode: code }),
    ...(error.cause === undefined ? {} : { cause: serializeError(error.cause, shown) }),
  };
}

/**
 * The backend's logger: one JSON object per line on stdout, or on
 * `destination`. The fields named in `REDACTED_FIELDS` are redacted at the top
 * of a line and one level down, and a failed query shows none of its values.
 */
export function createLogger(destination: DestinationStream = pino.destination(1)): Logger {
  return pino(
    {
      redact: {
        paths: REDACTED_FIELDS.flatMap((field) => [field, `*.${field}`]),
        censor: '[redacted]',
      },
      serializers: { err: (error: unknown) => serializeError(error) },
    },
    destination,
  );
}
