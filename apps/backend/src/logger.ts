import { pino, type DestinationStream, type Logger } from 'pino';

/** The fields a log line never shows: personal data and secrets (spec #333). */
const REDACTED_FIELDS = ['email', 'code', 'token', 'authorization'];

/**
 * The backend's logger: one JSON object per line on stdout, or on
 * `destination`. The fields named in `REDACTED_FIELDS` are redacted at the top
 * of a line and one level down.
 */
export function createLogger(destination: DestinationStream = pino.destination(1)): Logger {
  return pino(
    {
      redact: {
        paths: REDACTED_FIELDS.flatMap((field) => [field, `*.${field}`]),
        censor: '[redacted]',
      },
      serializers: {
        // An error's `code` names its kind (`ECONNREFUSED`, an SQLSTATE), not
        // a Sign-in code, so it is kept as `errorCode`.
        err: (error: Error) => {
          const { code, ...serialized }: Record<string, unknown> = pino.stdSerializers.err(error);
          return code === undefined ? serialized : { ...serialized, errorCode: code };
        },
      },
    },
    destination,
  );
}
