import { DrizzleQueryError } from 'drizzle-orm';
import pg from 'pg';
import { pino, type DestinationStream, type Logger } from 'pino';

import { framesOf, namesOf, scrubbed } from './error-text';

/**
 * Whether a `code` names a kind, as an error's does: a name (`ECONNREFUSED`,
 * `WRONG_CODE`, `too_small`) or an HTTP status. Anything else may be a
 * Sign-in code, which a sign-in request body and its error carry as `code`.
 */
function namesAKind(code: unknown): boolean {
  if (typeof code === 'number') return Number.isInteger(code) && code >= 100 && code < 600;
  return typeof code === 'string' && /^[A-Za-z][\w.-]*$/.test(code);
}

/**
 * Whether a field is one a log line never shows, at any depth: personal data
 * and secrets (spec #333). Any field that names a token, an email, a
 * password, a secret, a cookie or an authorization, and a `code` that may be
 * a Sign-in code.
 */
function isRedacted(field: string, value: unknown): boolean {
  if (field === 'code') return !namesAKind(value);
  return /token|email|password|secret|cookie|authorization/i.test(field);
}

/** An error's stack with the message at its top scrubbed as the error's report scrubs it. */
function scrubbedStack(error: Error): string | undefined {
  const { stack } = error;
  if (stack === undefined) return undefined;
  const frames = framesOf(error);
  return `${scrubbed(stack.slice(0, stack.length - frames.length))}${frames}`;
}

/** Whether a value is an object whose fields a log line shows. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A value as a log line shows it, at any depth: every redacted field
 * censored and every error serialized. Inside an error (`inError`), its
 * strings are scrubbed too, since an error's fields quote what its code met
 * (a request body, an address). A value met again is not shown twice.
 */
function cleaned(value: unknown, shown: WeakSet<object>, inError: boolean): unknown {
  if (value instanceof Error) return serializeError(value, shown);
  if (typeof value === 'string') return inError ? scrubbed(value) : value;
  if (!isRecord(value)) return value;
  if (shown.has(value)) return '[shown above]';
  shown.add(value);
  if (Array.isArray(value)) return value.map((item: unknown) => cleaned(item, shown, inError));
  const json: unknown = value['toJSON'];
  if (typeof json === 'function') return cleaned(json.call(value), shown, inError);
  return cleanedFields(value, shown, inError);
}

/** An object's own fields as a log line shows them: see `cleaned`. */
function cleanedFields(
  fields: Record<string, unknown>,
  shown: WeakSet<object>,
  inError: boolean,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [
      field,
      isRedacted(field, value) ? '[redacted]' : cleaned(value, shown, inError),
    ]),
  );
}

/** An error's fields that a log line shows apart, or not at all. */
const OWN_ERROR_FIELDS = new Set(['name', 'message', 'stack', 'code', 'cause', 'errors']);

/**
 * An error as a log line shows it. A failed query names its SQL, whose values
 * are `$1`, `$2`...: the values themselves (an email, a Session token, a
 * rate-limit key) stay out, and so do the message and the stack that repeat
 * them. Postgres's own error keeps what names it (the SQLSTATE, the
 * constraint, the table) and leaves out its message and detail, which may
 * quote a value. Any other error's message, and the top of its stack that
 * repeats it, are scrubbed as its report is: no email, token, IP address or
 * Sign-in code it quotes, and so are its other fields, at any depth. The
 * inner errors of an AggregateError are shown each as this function shows
 * it. A thrown value that is no error shows only its kind, or, a string,
 * scrubbed. An error met again down its own causes is not shown twice.
 */
function serializeError(error: unknown, shown: WeakSet<object>): unknown {
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
    const { code, ...names } = namesOf(error);
    return {
      type: 'DatabaseError',
      ...names,
      errorCode: code,
      stack: `DatabaseError${framesOf(error)}`,
    };
  }
  if (!(error instanceof Error)) {
    return {
      type: 'NonError',
      message: typeof error === 'string' ? scrubbed(error) : typeof error,
    };
  }
  const code: unknown = 'code' in error ? error.code : undefined;
  const fields = Object.fromEntries(
    Object.entries(error).filter(([field]) => !OWN_ERROR_FIELDS.has(field)),
  );
  return {
    type: error.constructor.name,
    ...cleanedFields(fields, shown, true),
    message: scrubbed(error.message),
    stack: scrubbedStack(error),
    // An error's `code` names its kind (`ECONNREFUSED`), not a Sign-in code.
    ...(code === undefined ? {} : { errorCode: cleaned(code, shown, true) }),
    ...(error instanceof AggregateError
      ? { errors: error.errors.map((inner: unknown) => serializeError(inner, shown)) }
      : {}),
    ...(error.cause === undefined ? {} : { cause: serializeError(error.cause, shown) }),
  };
}

/**
 * The backend's logger: one JSON object per line on stdout, or on
 * `destination`. A redacted field (`isRedacted`) is censored at any depth, an
 * error is scrubbed, and a failed query shows none of its values.
 */
export function createLogger(destination: DestinationStream = pino.destination(1)): Logger {
  return pino(
    {
      serializers: {
        // `formatters.log` has shown the error already; pino's own serializer stays out.
        err: (error: unknown) => error,
        // A line that names no message takes its error's, which may quote a value.
        msg: (message: unknown) => (typeof message === 'string' ? scrubbed(message) : message),
      },
      formatters: {
        bindings: (bindings) => cleanedFields(bindings, new WeakSet(), false),
        log: ({ err, ...fields }) => {
          const shown = new WeakSet<object>();
          return {
            ...cleanedFields(fields, shown, false),
            ...(err === undefined ? {} : { err: serializeError(err, shown) }),
          };
        },
      },
    },
    destination,
  );
}
