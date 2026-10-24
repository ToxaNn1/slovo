import type pg from 'pg';

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
export function scrubbed(message: string): string {
  return PERSONAL_DATA.reduce((text, [pattern, mark]) => text.replace(pattern, mark), message);
}

/** The `at ...` lines of an error's stack, without the message above them: the code's places, never a value. */
export function framesOf(error: Error): string {
  const stack = error.stack ?? '';
  const start = stack.indexOf('\n    at ');
  return start === -1 ? '' : stack.slice(start);
}

/**
 * What names a Postgres error without quoting a value: its SQLSTATE, the
 * constraint, the table and the like, never its message and detail, which
 * may quote one.
 */
export function namesOf(error: pg.DatabaseError) {
  const { severity, code, schema, table, column, dataType, constraint, routine } = error;
  return { severity, code, schema, table, column, dataType, constraint, routine };
}

/** A Postgres error named in one line: its SQLSTATE and constraint. */
export function nameOf(error: pg.DatabaseError): string {
  const { code, constraint } = namesOf(error);
  return [`SQLSTATE ${code ?? '?'}`, constraint].filter(Boolean).join(' ');
}
