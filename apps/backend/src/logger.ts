import { pino, type DestinationStream, type Logger } from 'pino';

/** What a log line never carries: personal data and secrets (spec #333). */
const SECRETS = ['email', 'code', 'token', 'authorization'];

/**
 * The backend's logger: one JSON object per line on stdout, or on
 * `destination`. The fields named in `SECRETS` are redacted at the top of a
 * line and one level down.
 */
export function createLogger(destination: DestinationStream = pino.destination(1)): Logger {
  return pino(
    {
      redact: {
        paths: SECRETS.flatMap((field) => [field, `*.${field}`]),
        censor: '[redacted]',
      },
    },
    destination,
  );
}
