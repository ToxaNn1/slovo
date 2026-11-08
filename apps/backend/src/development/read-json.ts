import type { SourceRead } from '@slovo/server-core';
import type { Logger } from 'pino';
import type { z } from 'zod';

/** How long a read of an outside service may take before it counts as unavailable. */
const TIMEOUT_MS = 10_000;

/**
 * Reads the JSON at the URL and parses it with the schema, where it enters.
 * A refusal, a network failure, a timeout or an answer of another shape is
 * `unavailable`, logged as a warning; it never throws.
 */
export async function readJson<Schema extends z.ZodType>(
  fetch: typeof globalThis.fetch,
  logger: Logger,
  url: string,
  init: RequestInit,
  schema: Schema,
): Promise<SourceRead<z.output<Schema>>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn({ url, status: response.status }, 'an outside service refused a read');
      return { ok: false, reason: 'unavailable' };
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      logger.warn({ url, err: parsed.error }, 'an outside service answered an unknown shape');
      return { ok: false, reason: 'unavailable' };
    }
    return { ok: true, value: parsed.data };
  } catch (error) {
    logger.warn({ url, err: error }, 'an outside service could not be read');
    return { ok: false, reason: 'unavailable' };
  }
}

/** A source of the port's shape that answers every read `unavailable`: its token is unset. */
export const unavailableRead = () => Promise.resolve({ ok: false, reason: 'unavailable' } as const);
