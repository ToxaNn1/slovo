import { scrubbed } from './personal-data';

/**
 * A copy of what went wrong with its message and stack scrubbed. An error
 * stays an error, so the log still shows where it came from.
 */
function withoutPersonalData(error: unknown): unknown {
  if (!(error instanceof Error)) return scrubbed(String(error));
  const copy = new Error(scrubbed(error.message));
  copy.name = error.name;
  if (error.stack !== undefined) copy.stack = scrubbed(error.stack);
  return copy;
}

/**
 * Writes an error to the device's log. A release build keeps that log where
 * anyone with the unlocked phone and a Mac can read it, so the message and the
 * error are scrubbed the way crash reports are: no email, token, IP address or
 * Sign-in code.
 */
export function logError(what: string, error: unknown): void {
  console.error(scrubbed(what), withoutPersonalData(error));
}

/** Writes a warning to the device's log, scrubbed like {@link logError}. */
export function logWarning(what: string, error: unknown): void {
  console.warn(scrubbed(what), withoutPersonalData(error));
}
